import { CONFIG, validateConfig_ } from './config';
import { fetchAllProducts_, fetchProductPage_, extractProducts_, isStigbergetProduct_, getLaunchDate_, getProductNumber_, getProductName_, getProducerName_, getProductNameThin_, formatDate_ } from './api';
import { getCalendar_, createMarker_, eventExists_, createCalendarEvent_, getCategory_ } from './calendar';

declare const global: any;

global.importStigbergetsAll = function importStigbergetsAll() {
  validateConfig_();
  const calendar = getCalendar_();

  Logger.log('========================================');
  Logger.log('STIGBERGETS – FULL IMPORT');
  Logger.log('========================================');
  Logger.log('Hämtar produkter från Systembolaget...');

  const products = fetchAllProducts_();
  Logger.log(`Produkter efter pagination: ${products.length}`);

  const stigbergetProducts = products.filter((product) => isStigbergetProduct_(product));
  Logger.log(`Produkter efter Stigberget-filter: ${stigbergetProducts.length}`);

  sortProductsByLaunchDate_(stigbergetProducts);

  let created = 0;
  let existing = 0;
  let missingDate = 0;
  let missingNumber = 0;

  stigbergetProducts.forEach((product) => {
    const launchDate = getLaunchDate_(product);
    if (!launchDate) {
      Logger.log(`SAKNAR RELEASEDATUM: ${getProductName_(product)}`);
      missingDate++;
      return;
    }

    const productNumber = getProductNumber_(product);
    if (!productNumber) {
      Logger.log(`SAKNAR ARTIKELNUMMER: ${getProductName_(product)}`);
      missingNumber++;
      return;
    }

    const marker = createMarker_(productNumber, launchDate);
    if (CONFIG.SKIP_EXISTING_EVENTS && eventExists_(calendar, launchDate, marker)) {
      Logger.log(`FINNS REDAN: ${productNumber} – ${getProductName_(product)}`);
      existing++;
      return;
    }

    createCalendarEvent_(calendar, product, launchDate);
    created++;
  });

  logSummary_('FULL IMPORT KLAR', products.length, stigbergetProducts.length, created, existing, missingDate, missingNumber);
};

global.importStigbergetsDaily = function importStigbergetsDaily() {
  validateConfig_();
  const calendar = getCalendar_();

  Logger.log('========================================');
  Logger.log('STIGBERGETS – DAGLIG IMPORT');
  Logger.log('========================================');

  const minDateString = getMinLookbackDateString_();
  Logger.log(`API-filter: releasedatum från ${minDateString} och framåt.`);

  const allProducts = fetchPaginatedProductsWithFilter_({ 'productLaunch.min': minDateString });
  const stigbergetProducts = allProducts.filter((product) => isStigbergetProduct_(product));
  Logger.log(`Stigberget-produkter: ${stigbergetProducts.length}`);

  sortProductsByLaunchDate_(stigbergetProducts);

  let created = 0;
  let existing = 0;
  let missingNumber = 0;

  stigbergetProducts.forEach((product) => {
    const launchDate = getLaunchDate_(product);
    if (!launchDate) return;

    const productNumber = getProductNumber_(product);
    if (!productNumber) {
      Logger.log(`SAKNAR ARTIKELNUMMER: ${getProductName_(product)}`);
      missingNumber++;
      return;
    }

    const marker = createMarker_(productNumber, launchDate);
    if (CONFIG.SKIP_EXISTING_EVENTS && eventExists_(calendar, launchDate, marker)) {
      Logger.log(`FINNS REDAN: ${productNumber} – ${getProductName_(product)}`);
      existing++;
      return;
    }

    createCalendarEvent_(calendar, product, launchDate);
    created++;
  });

  logDailySummary_(minDateString, allProducts.length, stigbergetProducts.length, created, existing, missingNumber);
};

global.inspectApi = function inspectApi() {
  validateConfig_();
  const url = `${CONFIG.API_URL}?textQuery=${encodeURIComponent(CONFIG.SEARCH_QUERY)}&page=1&pageSize=1`;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'Ocp-Apim-Subscription-Key': getApiKeyFromConfig_(),
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  Logger.log(`HTTP: ${code}`);

  if (code < 200 || code >= 300) {
    Logger.log(body);
    throw new Error(`API-anropet misslyckades: HTTP ${code}`);
  }

  const data = JSON.parse(body);
  const products = extractProductsArray_(data);
  if (!products.length) throw new Error(`Hittade inga produkter i API-svaret:\n${JSON.stringify(data, null, 2)}`);

  Logger.log('========================================');
  Logger.log('FÄLT SOM RETURNERAS');
  Logger.log('========================================');

  Object.keys(products[0])
    .sort()
    .forEach((key) => Logger.log(`${key} = ${JSON.stringify(products[0][key])}`));
};

global.testStigbergetFilter = function testStigbergetFilter() {
  validateConfig_();
  Logger.log('========================================');
  Logger.log('TESTAR STIGBERGET-FILTER');
  Logger.log('========================================');

  const products = fetchAllProducts_();
  Logger.log(`Totalt hämtade: ${products.length}`);

  let matches = 0;
  products.forEach((product) => {
    if (!isStigbergetProduct_(product)) return;
    matches++;
    Logger.log(`${getProductNumber_(product)} | ${getProductName_(product)} | Producent: ${getProducerName_(product)} | Release: ${formatDate_(getLaunchDate_(product))}`);
  });

  Logger.log('');
  Logger.log(`Antal Stigberget-matchningar: ${matches}`);
};

global.testImport = function testImport() {
  validateConfig_();
  Logger.log('========================================');
  Logger.log('TESTIMPORT');
  Logger.log('========================================');

  const products = fetchAllProducts_();
  const stigbergetProducts = products.filter((product) => isStigbergetProduct_(product));
  sortProductsByLaunchDate_(stigbergetProducts);

  Logger.log(`Totalt hämtade: ${products.length}`);
  Logger.log(`Stigberget-produkter: ${stigbergetProducts.length}`);
  Logger.log('');
  Logger.log('PRODUKTER SOM SKULLE IMPORTERAS');
  Logger.log('========================================');

  stigbergetProducts.forEach((product) => {
    const launchDate = getLaunchDate_(product);
    const productNumber = getProductNumber_(product);

    Logger.log('');
    Logger.log('----------------------------------------');
    Logger.log(`Release: ${formatDate_(launchDate)}`);
    Logger.log(`Titel: ${CONFIG.EVENT_PREFIX}${getProductName_(product)}`);
    Logger.log(`Producent: ${getProducerName_(product)}`);
    Logger.log(`Produkt: ${getProductNameThin_(product)}`);
    Logger.log(`Kategori: ${getCategory_(product)}`);
    Logger.log(`Artikelnummer: ${productNumber}`);
    Logger.log(`Marker: ${createMarker_(productNumber, launchDate)}`);
  });

  Logger.log('');
  Logger.log('========================================');
  Logger.log('TESTIMPORT KLAR');
  Logger.log('Inga kalenderhändelser skapades.');
  Logger.log('========================================');
};

global.clearCalendar = function clearCalendar() {
  const targetCalendarName = 'Stigbergets';
  const calendars = CalendarApp.getCalendarsByName(targetCalendarName);
  if (!calendars.length) {
    Logger.log(`Hittade ingen kalender med namnet: ${targetCalendarName}`);
    return;
  }

  const calendar = calendars[0];
  const startDate = new Date(2015, 0, 1);
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  const events = calendar.getEvents(startDate, endDate);
  Logger.log(`Hittade ${events.length} händelser att radera.`);

  events.forEach((event) => event.deleteEvent());
  Logger.log('Kalendern har rensats.');
};

function sortProductsByLaunchDate_(products: any[]): void {
  products.sort((a, b) => {
    const dateA = getLaunchDate_(a);
    const dateB = getLaunchDate_(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  });
}

function getMinLookbackDateString_(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - CONFIG.DAILY_LOOKBACK_DAYS);
  return formatDate_(minDate);
}

function fetchPaginatedProductsWithFilter_(extraParams: Record<string, string | number>): any[] {
  const allProducts: any[] = [];
  const seen: Record<string, boolean> = {};

  for (let page = 1; page <= CONFIG.MAX_PAGES; page++) {
    Logger.log(`Hämtar sida ${page}...`);
    const response = fetchProductPage_(page, extraParams);
    const products = extractProducts_(response);
    Logger.log(`Sida ${page}: ${products.length} produkter`);

    if (!products.length) break;

    let newProductsCount = 0;
    products.forEach((product) => {
      const productNumber = getProductNumber_(product);
      const launchDate = getLaunchDate_(product);
      const id = productNumber && launchDate ? `${productNumber}:${formatDate_(launchDate)}` : String(product.productId || product.ProductId || '');

      if (!id || seen[id]) return;

      seen[id] = true;
      allProducts.push(product);
      newProductsCount++;
    });

    if (newProductsCount === 0 || products.length < CONFIG.PAGE_SIZE) break;
  }

  return allProducts;
}

function extractProductsArray_(data: any): any[] {
  if (Array.isArray(data)) return data;
  return data?.products || data?.ProductSearchResults || data?.data?.products || data?.data?.ProductSearchResults || [];
}

function getApiKeyFromConfig_(): string {
  const apiKey = PropertiesService.getScriptProperties().getProperty('SYSTEMBOLAGET_API_KEY');
  if (!apiKey) throw new Error('Script Property "SYSTEMBOLAGET_API_KEY" saknas.');
  return apiKey.trim();
}

function logSummary_(title: string, totalFetched: number, filtered: number, created: number, existing: number, missingDate: number, missingNumber: number): void {
  Logger.log('');
  Logger.log('========================================');
  Logger.log(title);
  Logger.log('========================================');
  Logger.log(`Produkter hämtade: ${totalFetched}`);
  Logger.log(`Stigberget-produkter: ${filtered}`);
  Logger.log(`Skapade events: ${created}`);
  Logger.log(`Redan befintliga: ${existing}`);
  Logger.log(`Utan releasedatum: ${missingDate}`);
  Logger.log(`Utan artikelnummer: ${missingNumber}`);
  Logger.log('========================================');
}

function logDailySummary_(minDateString: string, totalFetched: number, filtered: number, created: number, existing: number, missingNumber: number): void {
  Logger.log('');
  Logger.log('========================================');
  Logger.log('DAGLIG IMPORT KLAR');
  Logger.log('========================================');
  Logger.log(`API-datumfilter: från ${minDateString}`);
  Logger.log(`Produkter hämtade från API:t: ${totalFetched}`);
  Logger.log(`Stigberget-produkter: ${filtered}`);
  Logger.log(`Skapade events: ${created}`);
  Logger.log(`Redan befintliga: ${existing}`);
  Logger.log(`Utan artikelnummer: ${missingNumber}`);
  Logger.log('========================================');
}