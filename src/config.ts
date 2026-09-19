export interface Config {
  API_URL: string;
  SEARCH_QUERY: string;
  PAGE_SIZE: number;
  MAX_PAGES: number;
  CALENDAR_NAME: string;
  RELEASE_START_HOUR: number;
  RELEASE_START_MINUTE: number;
  RELEASE_END_HOUR: number;
  RELEASE_END_MINUTE: number;
  LOCATION: string;
  EVENT_PREFIX: string;
  SKIP_EXISTING_EVENTS: boolean;
  DAILY_LOOKBACK_DAYS: number;
  LOG_SEPARATOR: string;
  LOG_SUB_SEPARATOR: string;
}

export const CONFIG: Config = {
  API_URL: 'https://api-extern.systembolaget.se/sb-api-ecommerce/v1/productsearch/search',
  SEARCH_QUERY: 'stigberget',
  PAGE_SIZE: 30,
  MAX_PAGES: 100,
  CALENDAR_NAME: 'Stigbergets',
  RELEASE_START_HOUR: 10,
  RELEASE_START_MINUTE: 0,
  RELEASE_END_HOUR: 19,
  RELEASE_END_MINUTE: 0,
  LOCATION: 'Systembolaget',
  EVENT_PREFIX: '🍺 Release: ',
  SKIP_EXISTING_EVENTS: true,
  DAILY_LOOKBACK_DAYS: 7,
  LOG_SEPARATOR: '========================================',
  LOG_SUB_SEPARATOR: '----------------------------------------',
};

export function getApiKey_(): string {
  const apiKey = PropertiesService.getScriptProperties().getProperty('SYSTEMBOLAGET_API_KEY');
  if (!apiKey) {
    throw new Error(
      'Script Property "SYSTEMBOLAGET_API_KEY" is missing.\n\n' +
      'Go to Project Settings → Script Properties and add the API key there.'
    );
  }
  return apiKey.trim();
}

export function validateConfig_(): void {
  getApiKey_();
  if (!CONFIG.API_URL) throw new Error('CONFIG.API_URL is missing.');
  if (!CONFIG.SEARCH_QUERY) throw new Error('CONFIG.SEARCH_QUERY is missing.');
}