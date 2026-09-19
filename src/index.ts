import { CONFIG, validateConfig_ } from './config';
import { fetchAllProducts_, fetchProductPage_, extractProducts_, isStigbergetProduct_, getLaunchDate_, getProductNumber_, getProductName_, getProducerName_, getProductNameThin_, formatDate_ } from './api';
import { getCalendar_, createMarker_, eventExists_, createCalendarEvent_, getCategory_ } from './calendar';

declare const global: any;

global.importStigbergetsAll = function importStigbergetsAll() {
  validateConfig_();
  const calendar = getCalendar_();

  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log('STIGBERGETS – FULL IMPORT');
  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log('Fetching products from Systembolaget...');

  const products = fetchAllProducts_();
  Logger.log(`Products after pagination: ${products.length}`);

  const stigbergetProducts = products.filter((product) => isStigbergetProduct_(product));
  Logger.log(`Products after Stigberget filter: ${stigbergetProducts.length}`);

  sortProductsByLaunchDate_(stigbergetProducts);

  let created = 0;
  let existing = 0;
  let missingDate = 0;
  let missingNumber = 0;

  stigbergetProducts.forEach((product) => {
    const launchDate = getLaunchDate_(product);
    if (!launchDate) {
      Logger.log(`MISSING RELEASE DATE: ${getProductName_(product)}`);
      missingDate++;
      return;
    }

    const productNumber = getProductNumber_(product);
    if (!productNumber) {
      Logger.log(`MISSING PRODUCT NUMBER: ${getProductName_(product)}`);
      missingNumber++;
      return;
    }

    const marker = createMarker_(productNumber, launchDate);
    if (CONFIG.SKIP_EXISTING_EVENTS && eventExists_(calendar, launchDate, marker)) {
      Logger.log(`ALREADY EXISTS: ${productNumber} – ${getProductName_(product)}`);
      existing++;
      return;
    }

    createCalendarEvent_(calendar, product, launchDate);
    created++;
  });

  logSummary_('FULL IMPORT COMPLETED', products.length, stigbergetProducts.length, created, existing, missingDate, missingNumber);
};

global.importStigbergetsDaily = function importStigbergetsDaily() {
  validateConfig_();
  const calendar = getCalendar_();

  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log('STIGBERGETS – DAILY IMPORT');
  Logger.log(CONFIG.LOG_SEPARATOR);

  const minDateString = getMinLookbackDateString_();
  Logger.log(`API filter: launch date from ${minDateString} onwards.`);

  const allProducts = fetchPaginatedProductsWithFilter_({ 'productLaunch.min': minDateString });
  const stigbergetProducts = allProducts.filter((product) => isStigbergetProduct_(product));
  Logger.log(`Stigberget products: ${stigbergetProducts.length}`);

  sortProductsByLaunchDate_(stigbergetProducts);

  let created = 0;
  let existing = 0;
  let missingNumber = 0;

  stigbergetProducts.forEach((product) => {
    const launchDate = getLaunchDate_(product);
    if (!launchDate) return;

    const productNumber = getProductNumber_(product);
    if (!productNumber) {
      Logger.log(`MISSING PRODUCT NUMBER: ${getProductName_(product)}`);
      missingNumber++;
      return;
    }

    const marker = createMarker_(productNumber, launchDate);
    if (CONFIG.SKIP_EXISTING_EVENTS && eventExists_(calendar, launchDate, marker)) {
      Logger.log(`ALREADY EXISTS: ${productNumber} – ${getProductName_(product)}`);
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
    throw new Error(`API call failed: HTTP ${code}`);
  }

  const data = JSON.parse(body);
  const products = extractProductsArray_(data);
  if (!products.length) throw new Error(`No products found in API response:\n${JSON.stringify(data, null, 2)}`);

  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log('RETURNED FIELDS');
  Logger.log(CONFIG.LOG_SEPARATOR);

  Object.keys(products[0])
    .sort()
    .forEach((key) => Logger.log(`${key} = ${JSON.stringify(products[0][key])}`));
};

global.testStigbergetFilter = function testStigbergetFilter() {
  validateConfig_();
  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log('TESTING STIGBERGET FILTER');
  Logger.log(CONFIG.LOG_SEPARATOR);

  const products = fetchAllProducts_();
  Logger.log(`Total fetched: ${products.length}`);

  let matches = 0;
  products.forEach((product) => {
    if (!isStigbergetProduct_(product)) return;
    matches++;
    Logger.log(`${getProductNumber_(product)} | ${getProductName_(product)} | Producer: ${getProducerName_(product)} | Launch: ${formatDate_(getLaunchDate_(product))}`);
  });

  Logger.log('');
  Logger.log(`Number of Stigberget matches: ${matches}`);
};

global.testImport = function testImport() {
  validateConfig_();
  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log('TEST IMPORT');
  Logger.log(CONFIG.LOG_SEPARATOR);

  const products = fetchAllProducts_();
  const stigbergetProducts = products.filter((product) => isStigbergetProduct_(product));
  sortProductsByLaunchDate_(stigbergetProducts);

  Logger.log(`Total fetched: ${products.length}`);
  Logger.log(`Stigberget products: ${stigbergetProducts.length}`);
  Logger.log('');
  Logger.log('PRODUCTS TO BE IMPORTED');
  Logger.log(CONFIG.LOG_SEPARATOR);

  stigbergetProducts.forEach((product) => {
    const launchDate = getLaunchDate_(product);
    const productNumber = getProductNumber_(product);

    Logger.log('');
    Logger.log(CONFIG.LOG_SUB_SEPARATOR);
    Logger.log(`Launch: ${formatDate_(launchDate)}`);
    Logger.log(`Title: ${CONFIG.EVENT_PREFIX}${getProductName_(product)}`);
    Logger.log(`Producer: ${getProducerName_(product)}`);
    Logger.log(`Product: ${getProductNameThin_(product)}`);
    Logger.log(`Category: ${getCategory_(product)}`);
    Logger.log(`Product Number: ${productNumber}`);
    Logger.log(`Marker: ${createMarker_(productNumber, launchDate)}`);
  });

  Logger.log('');
  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log('TEST IMPORT COMPLETED');
  Logger.log('No calendar events were created.');
  Logger.log(CONFIG.LOG_SEPARATOR);
};

global.clearCalendar = function clearCalendar() {
  const targetCalendarName = CONFIG.CALENDAR_NAME;
  const calendars = CalendarApp.getCalendarsByName(targetCalendarName);
  if (!calendars.length) {
    Logger.log(`No calendar found with name: ${targetCalendarName}`);
    return;
  }

  const calendar = calendars[0];
  const startDate = new Date(2015, 0, 1);
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  const events = calendar.getEvents(startDate, endDate);
  Logger.log(`Found ${events.length} events to delete.`);

  events.forEach((event) => event.deleteEvent());
  Logger.log('Calendar has been cleared.');
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
    Logger.log(`Fetching page ${page}...`);
    const response = fetchProductPage_(page, extraParams);
    const products = extractProducts_(response);
    Logger.log(`Page ${page}: ${products.length} products`);

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
  if (!apiKey) throw new Error('Script Property "SYSTEMBOLAGET_API_KEY" is missing.');
  return apiKey.trim();
}

function logSummary_(title: string, totalFetched: number, filtered: number, created: number, existing: number, missingDate: number, missingNumber: number): void {
  Logger.log('');
  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log(title);
  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log(`Products fetched: ${totalFetched}`);
  Logger.log(`Stigberget products: ${filtered}`);
  Logger.log(`Created events: ${created}`);
  Logger.log(`Already existing: ${existing}`);
  Logger.log(`Without release date: ${missingDate}`);
  Logger.log(`Without product number: ${missingNumber}`);
  Logger.log(CONFIG.LOG_SEPARATOR);
}

function logDailySummary_(minDateString: string, totalFetched: number, filtered: number, created: number, existing: number, missingNumber: number): void {
  Logger.log('');
  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log('DAILY IMPORT COMPLETED');
  Logger.log(CONFIG.LOG_SEPARATOR);
  Logger.log(`API date filter: from ${minDateString}`);
  Logger.log(`Products fetched from API: ${totalFetched}`);
  Logger.log(`Stigberget products: ${filtered}`);
  Logger.log(`Created events: ${created}`);
  Logger.log(`Already existing: ${existing}`);
  Logger.log(`Without product number: ${missingNumber}`);
  Logger.log(CONFIG.LOG_SEPARATOR);
}