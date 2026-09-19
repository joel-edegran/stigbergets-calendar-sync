import { CONFIG } from './config';
import {
  SystembolagetProduct,
  getProductName_,
  getProductNumber_,
  getProducerName_,
  getProductNameThin_,
  getLaunchDate_,
  formatDate_,
} from './api';

export function getCalendar_(): GoogleAppsScript.Calendar.Calendar {
  const calendars = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
  if (calendars.length > 0) return calendars[0];

  Logger.log(`Calendar "${CONFIG.CALENDAR_NAME}" does not exist. Creating it.`);
  return CalendarApp.createCalendar(CONFIG.CALENDAR_NAME);
}

export function createMarker_(productNumber: string, date: Date | null): string {
  return `[STIGBERGET-CALENDAR:${productNumber}:${formatDate_(date)}]`;
}

export function eventExists_(calendar: GoogleAppsScript.Calendar.Calendar, date: Date, marker: string): boolean {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);

  return calendar.getEvents(start, end).some((event) => (event.getDescription() || '').indexOf(marker) !== -1);
}

export function createCalendarEvent_(calendar: GoogleAppsScript.Calendar.Calendar, product: SystembolagetProduct, launchDate: Date): void {
  const name = getProductName_(product);
  const productNumber = getProductNumber_(product);

  const start = new Date(launchDate);
  start.setHours(CONFIG.RELEASE_START_HOUR, CONFIG.RELEASE_START_MINUTE, 0, 0);

  const end = new Date(launchDate);
  end.setHours(CONFIG.RELEASE_END_HOUR, CONFIG.RELEASE_END_MINUTE, 0, 0);

  calendar.createEvent(CONFIG.EVENT_PREFIX + name, start, end, {
    location: CONFIG.LOCATION,
    description: buildDescription_(product),
  });

  Logger.log(`CREATED: ${formatDate_(launchDate)} ${name} (${productNumber})`);
}

function buildDescription_(product: SystembolagetProduct): string {
  const lines: string[] = [];

  const producerName = getProducerName_(product);
  if (producerName) lines.push(producerName);

  const productNameThin = getProductNameThin_(product);
  if (productNameThin) lines.push(productNameThin);

  if (producerName || productNameThin) lines.push('');

  const category = getCategory_(product);
  if (category) lines.push(category, '');

  const price = getPrice_(product);
  if (price) lines.push(`${price} kr`);

  const productNumber = getProductNumber_(product);
  if (productNumber) lines.push(`No. ${productNumber}`);

  const packageText = getPackageText_(product);
  if (packageText) lines.push(packageText);

  const alcohol = getAlcohol_(product);
  if (alcohol) lines.push(`${alcohol} % vol.`);

  const standardGlasses = getStandardGlasses_(product);
  if (standardGlasses) lines.push(`${standardGlasses} standard glasses`);

  lines.push('');

  const taste = getTaste_(product);
  if (taste) lines.push(taste, '');

  const usage = getUsage_(product);
  if (usage) lines.push(usage, '');

  const url = getProductUrl_(product);
  if (url) lines.push(url);

  lines.push('', createMarker_(productNumber, getLaunchDate_(product)));

  return lines.join('\n');
}

export function getCategory_(product: SystembolagetProduct): string {
  return [product.categoryLevel1, product.categoryLevel2, product.categoryLevel3, product.categoryLevel4]
    .map((val) => (val ? String(val).trim() : ''))
    .filter(Boolean)
    .join(' > ');
}

function getPrice_(product: SystembolagetProduct): string {
  const rawValue = product.priceInclVat ?? product.PriceInclVat ?? product.price ?? product.Price;
  if (rawValue === null || rawValue === undefined) return '';

  const stringValue = String(rawValue).trim();
  if (!stringValue) return '';

  const num = Number(stringValue);
  if (!Number.isFinite(num)) return stringValue;

  return num.toFixed(2).replace('.', ',');
}

function getPackageText_(product: SystembolagetProduct): string {
  const packaging = product.bottleText || product.BottleText || product.packaging || product.Packaging || '';
  const volumeText = product.volumeText || product.VolumeText || '';
  const volume = product.volume || product.Volume || '';
  const volumePart = volumeText || (volume ? `${Number(volume)} ml` : '');

  if (packaging && volumePart) return `${packaging} ${volumePart}`;
  return packaging || volumePart || '';
}

function getAlcohol_(product: SystembolagetProduct): string {
  const rawValue = product.alcoholPercentage ?? product.AlcoholPercentage ?? product.alcohol ?? product.Alcohol ?? null;
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') return '';

  const num = Number(rawValue);
  if (!Number.isFinite(num)) return String(rawValue);

  return String(num).replace('.', ',');
}

function getStandardGlasses_(product: SystembolagetProduct): string {
  const rawValue = product.standardGlasses ?? product.StandardGlasses ?? product.standardGlass ?? product.StandardGlass ?? null;
  if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '') {
    const num = Number(rawValue);
    return Number.isFinite(num) ? num.toFixed(1).replace('.', ',') : String(rawValue);
  }

  const alcohol = Number(product.alcoholPercentage ?? product.AlcoholPercentage ?? 0);
  const volume = Number(product.volume ?? product.Volume ?? 0);
  if (!alcohol || !volume) return '';

  const gramsPerAlcoholPercentAndMl = 0.789;
  const gramsPerStandardGlass = 12;
  const totalGrams = volume * (alcohol / 100) * gramsPerAlcoholPercentAndMl;
  const glasses = totalGrams / gramsPerStandardGlass;

  return glasses.toFixed(1).replace('.', ',');
}

function getTaste_(product: SystembolagetProduct): string {
  return product.taste || product.Taste || product.tasteDescription || product.TasteDescription || '';
}

function getUsage_(product: SystembolagetProduct): string {
  return product.usage || product.Usage || '';
}

function getProductUrl_(product: SystembolagetProduct): string {
  const directUrl = product.productUrl || product.ProductUrl || product.url || product.Url || '';
  if (directUrl) return directUrl;

  const productNumber = getProductNumber_(product);
  if (!productNumber) return '';

  return `https://www.systembolaget.se/produkt/ol/${slugify_(getProductName_(product))}-${encodeURIComponent(productNumber)}/`;
}

function slugify_(text: string): string {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}