import { CONFIG, validateConfig_, getApiKey_ } from './config';
import { fetchAllProducts_, fetchProductPage_, extractProducts_, isStigbergetProduct_, getLaunchDate_, getProductNumber_, getProductName_, getProducerName_, getProductNameThin_, formatDate_ } from './api';
import { getCalendar_, createMarker_, eventExists_, createCalendarEvent_, getCategory_ } from './calendar';

// Exponera funktioner globalt för Apps Script (eftersom Vite bygger till IIFE)
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

  stigbergetProducts.sort((a, b) => {
    const dateA = getLaunchDate_(a);
    const dateB = getLaunchDate_(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  });

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

  Logger.log('');
  Logger.log('========================================');
  Logger.log('FULL IMPORT KLAR');
  Logger.log('========================================');
  Logger.log(`Produkter hämtade: ${products.length}`);
  Logger.log(`Stigberget-produkter: ${stigbergetProducts.length}`);
  Logger.log(`Skapade events: ${created}`);
  Logger.log(`Redan befintliga: ${existing}`);
  Logger.log(`Utan releasedatum: ${missingDate}`);
  Logger.log(`Utan artikelnummer: ${missingNumber}`);
  Logger.log('========================================');
};

global.importStigbergetsDaily = function importStigbergetsDaily() {
  validateConfig_();
  const calendar = getCalendar_();

  Logger.log('========================================');
  Logger.log('STIGBERGETS – DAGLIG IMPORT');
  Logger.log('========================================');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - CONFIG.DAILY_LOOKBACK_DAYS);
  const minDateString = formatDate_(minDate);

  Logger.log(`API-filter: releasedatum från ${minDateString} och framåt.`);

  const allProducts: any[] = [];
  const seen: Record<string, boolean> = {};

  for (let page = 1; page <= CONFIG.MAX_PAGES; page++) {
    Logger.log(`Hämtar sida ${page}...`);
    const response = fetchProductPage_(page, { 'productLaunch.min': minDateString });
    const products = extractProducts_(response);
    Logger.log(`Sida ${page}: ${products.length} produkter`);

    if (!products.length) break;

    let newProducts = 0;
    products.forEach((product) => {
      const productNumber = getProductNumber_(product);
      const launchDate = getLaunchDate_(product);
      const id = productNumber && launchDate ? `${productNumber}:${formatDate_(launchDate)}` : String(product.productId || product.ProductId || '');

      if (!id) return;

      if (!seen[id]) {
        seen[id] = true;
        allProducts.push(product);
        newProducts++;
      }
    });

    if (newProducts === 0) {
      Logger.log(`Inga nya produkter på sida ${page}. Stoppar pagination.`);
      break;
    }

    if (products.length < CONFIG.PAGE_SIZE) break;
  }

  const stigbergetProducts = allProducts.filter((product) => isStigbergetProduct_(product));
  Logger.log(`Stigberget-produkter: ${stigbergetProducts.length}`);

  stigbergetProducts.sort((a, b) => {
    const dateA = getLaunchDate_(a);
    const dateB = getLaunchDate_(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  });

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

  Logger.log('');
  Logger.log('========================================');
  Logger.log('DAGLIG IMPORT KLAR');
  Logger.log('========================================');
  Logger.log(`API-datumfilter: från ${minDateString}`);
  Logger.log(`Produkter hämtade från API:t: ${allProducts.length}`);
  Logger.log(`Stigberget-produkter: ${stigbergetProducts.length}`);
  Logger.log(`Skapade events: ${created}`);
  Logger.log(`Redan befintliga: ${existing}`);
  Logger.log(`Utan artikelnummer: ${missingNumber}`);
  Logger.log('========================================');
};

global.inspectApi = function inspectApi() {
  validateConfig_();
  const url = `${CONFIG.API_URL}?textQuery=${encodeURIComponent(CONFIG.SEARCH_QUERY)}&page=1&pageSize=1`;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'Ocp-Apim-Subscription-Key': getApiKey_(),
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
  const products = Array.isArray(data) ? data : data.products || data.ProductSearchResults || data.data?.products || data.data?.ProductSearchResults || [];

  if (!products.length) {
    throw new Error(`Hittade inga produkter i API-svaret:\n${JSON.stringify(data, null, 2)}`);
  }

  const product = products[0];
  Logger.log('========================================');
  Logger.log('FÄLT SOM RETURNERAS');
  Logger.log('========================================');

  Object.keys(product)
    .sort()
    .forEach((key) => {
      Logger.log(`${key} = ${JSON.stringify(product[key])}`);
    });
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
    if (isStigbergetProduct_(product)) {
      matches++;
      Logger.log(`${getProductNumber_(product)} | ${getProductName_(product)} | Producent: ${getProducerName_(product)} | Release: ${formatDate_(getLaunchDate_(product))}`);
    }
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
  Logger.log(`Totalt hämtade: ${products.length}`);

  const stigbergetProducts = products.filter((product) => isStigbergetProduct_(product));
  Logger.log(`Stigberget-produkter: ${stigbergetProducts.length}`);

  stigbergetProducts.sort((a, b) => {
    const dateA = getLaunchDate_(a);
    const dateB = getLaunchDate_(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  });

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
    Logger.log(`Produ producent: ${getProducerName_(product)}`);
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

  if (calendars.length === 0) {
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