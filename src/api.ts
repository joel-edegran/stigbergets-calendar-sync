import { CONFIG, getApiKey_ } from './config';

export interface SystembolagetProduct {
  productNumber?: string;
  productNumberShort?: string;
  productNameBold?: string;
  name?: string;
  productNameThin?: string;
  nameThin?: string;
  producerName?: string;
  producer?: string;
  productLaunchDate?: string;
  productLaunch?: string;
  taste?: string;
  tasteDescription?: string;
  tasteAndUsage?: string;
  usage?: string;
  customCategoryTitle?: string;
  categoryLevel1?: string;
  categoryLevel2?: string;
  categoryLevel3?: string;
  categoryLevel4?: string;
  priceInclVat?: number;
  price?: number;
  bottleText?: string;
  packaging?: string;
  packageType?: string;
  volumeText?: string;
  volume?: number;
  alcoholPercentage?: number;
  alcohol?: number;
  standardGlasses?: number;
  standardGlass?: number;
  productUrl?: string;
  url?: string;
  productId?: string | number;
  [key: string]: any;
}

export function fetchProductPage_(page: number, extraParams?: Record<string, string | number>): any {
  const params: Record<string, string | number> = {
    textQuery: CONFIG.SEARCH_QUERY,
    page: page,
    pageSize: CONFIG.PAGE_SIZE,
    sortBy: 'ProductLaunchDate',
    sortDirection: 'Ascending',
    ...(extraParams || {}),
  };

  const query = Object.keys(params)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const url = `${CONFIG.API_URL}?${query}`;
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'Ocp-Apim-Subscription-Key': getApiKey_(),
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  };

  const maxAttempts = 4;
  const backoffMultiplierMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const body = response.getContentText();

    if (code >= 200 && code < 300) {
      try {
        return JSON.parse(body);
      } catch (error) {
        throw new Error(`API-svaret kunde inte tolkas som JSON.\n\n${body.substring(0, 5000)}`);
      }
    }

    Logger.log(`API-fel HTTP ${code} (försök ${attempt}/${maxAttempts})`);
    if (code !== 429 && code < 500) {
      throw new Error(`Systembolagets API returnerade HTTP ${code}:\n\n${body.substring(0, 5000)}`);
    }

    Utilities.sleep(attempt * backoffMultiplierMs);
  }

  throw new Error('Systembolagets API gick inte att nå efter flera försök.');
}

export function extractProducts_(response: any): SystembolagetProduct[] {
  if (Array.isArray(response)) return response;

  const productsList = response?.products || response?.ProductSearchResults || response?.data?.products || response?.data?.ProductSearchResults;
  if (Array.isArray(productsList)) return productsList;

  throw new Error(`Hittade ingen produktlista i API-svaret.\n\n${JSON.stringify(response, null, 2).substring(0, 10000)}`);
}

export function fetchAllProducts_(): SystembolagetProduct[] {
  const allProducts: SystembolagetProduct[] = [];
  const seen: Record<string, boolean> = {};

  for (let page = 1; page <= CONFIG.MAX_PAGES; page++) {
    Logger.log(`Hämtar sida ${page}...`);
    const products = extractProducts_(fetchProductPage_(page));
    Logger.log(`Sida ${page}: ${products.length} produkter`);

    if (!products.length) break;

    let newProductsCount = 0;
    products.forEach((product) => {
      const id = getProductNumber_(product) || String(product.productId || product.ProductId || '');
      if (!id || seen[id]) return;

      seen[id] = true;
      allProducts.push(product);
      newProductsCount++;
    });

    if (newProductsCount === 0 || products.length < CONFIG.PAGE_SIZE) break;
  }

  return allProducts;
}

export function isStigbergetProduct_(product: SystembolagetProduct): boolean {
  const searchTerm = CONFIG.SEARCH_QUERY.toLowerCase();
  const searchableFields = [
    product.productNameBold,
    product.productNameThin,
    product.producerName,
    product.taste,
    product.usage,
    product.customCategoryTitle,
  ];

  return searchableFields.some((value) => {
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().indexOf(searchTerm) !== -1;
  });
}

export function getProductNumber_(product: SystembolagetProduct): string {
  return String(
    product.productNumber ||
    product.ProductNumber ||
    product.productNumberShort ||
    product.ProductNumberShort ||
    ''
  ).trim();
}

export function getProductName_(product: SystembolagetProduct): string {
  const bold = String(product.productNameBold || product.ProductNameBold || product.name || '').trim();
  const thin = String(product.productNameThin || product.ProductNameThin || product.nameThin || '').trim();

  if (bold && thin) return `${bold} - ${thin}`;
  return bold || thin || 'Okänd produkt';
}

export function getProducerName_(product: SystembolagetProduct): string {
  return firstNonEmpty_(product.producerName, product.ProducerName, product.producer, product.Producer);
}

export function getProductNameThin_(product: SystembolagetProduct): string {
  return firstNonEmpty_(product.productNameThin, product.ProductNameThin, product.nameThin, product.NameThin);
}

export function getLaunchDate_(product: SystembolagetProduct): Date | null {
  const raw = product.productLaunchDate || product.ProductLaunchDate || product.productLaunch || product.ProductLaunch || null;
  if (!raw) return null;

  const date = new Date(raw);
  if (isNaN(date.getTime())) return null;

  const timezone = Session.getScriptTimeZone();
  const year = Number(Utilities.formatDate(date, timezone, 'yyyy'));
  const month = Number(Utilities.formatDate(date, timezone, 'MM')) - 1;
  const day = Number(Utilities.formatDate(date, timezone, 'dd'));

  return new Date(year, month, day);
}

export function formatDate_(date: Date | null): string {
  if (!date) return 'SAKNAS';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

export function firstNonEmpty_(...args: any[]): string {
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}