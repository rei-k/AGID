import * as OpenCC from 'opencc-js';
import { pinyin } from 'pinyin-pro';

/**
 * Chinese Address Specialized Utilities
 * Implements the architecture requested for CN Mainland, HK, MO, and TW.
 */

// Converters
const s2tw = OpenCC.Converter({ from: 'cn', to: 'tw' });
const s2hk = OpenCC.Converter({ from: 'cn', to: 'hk' });
const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });

// Shipping English Dictionary (as requested)
const SHIPPING_ENGLISH_DICT: Record<string, string> = {
  '省': 'Province',
  '自治区': 'Autonomous Region',
  '市': '', // Usually omitted in international shipping for cities like Shenzhen
  '区': 'District',
  '县': 'County',
  '路': 'Rd',
  '街': 'St',
  '道': 'Ave',
  '号': 'No.',
  '楼': 'Bldg',
  '室': 'Rm',
  '大厦': 'Building',
  '公寓': 'Apartment',
  '村': 'Village',
  '镇': 'Town',
  '乡': 'Township'
};

/**
 * Layer 1: Input Absorption & Canonicalization
 * Handles Simplified/Traditional/Dialect variations.
 */
export function toSimplified(text: string): string {
  if (!text) return "";
  // Basic manual overrides for common variations mentioned in request
  const customMap: Record<string, string> = {
    '臺': '台',
    '廣': '广',
    '澳門': '澳门',
    '深圳灣': '深圳湾'
  };
  let result = text;
  Object.entries(customMap).forEach(([k, v]) => {
    result = result.replace(new RegExp(k, 'g'), v);
  });
  return t2s(result);
}

export function toTraditional(text: string, region: 'TW' | 'HK' | 'MO' = 'TW'): string {
  if (!text) return "";
  if (region === 'HK' || region === 'MO') {
    return s2hk(text);
  }
  return s2tw(text);
}

/**
 * Detects if a string contains Simplified, Traditional, or mixed Chinese characters.
 */
export function detectChineseScript(text: string): 'simplified' | 'traditional' | 'mixed' | 'none' {
  if (!text || !/[\u4e00-\u9faf]/.test(text)) return 'none';
  
  const simplified = toSimplified(text);
  const traditional = toTraditional(text);
  
  if (text === simplified && text !== traditional) return 'simplified';
  if (text === traditional && text !== simplified) return 'traditional';
  if (text !== simplified && text !== traditional) return 'mixed';
  return 'none';
}

/**
 * Layer 2: Administrative Division Canonicalization
 * Ensures standard names for provinces/cities.
 */
export function canonicalizeCN(details: any): any {
  const result = { ...details };
  // Ensure Simplified Chinese for Mainland
  const fields = ['state', 'city', 'district', 'subdistrict', 'road', 'building', 'amenity', 'shop'];
  fields.forEach(f => {
    if (result[f]) result[f] = toSimplified(result[f]);
  });
  
  // Clean common suffixes if they are redundant (Heuristic)
  if (result.city && result.city.endsWith('市') && result.city.length > 2) {
    // Keep it for domestic, but we might mark it for international
  }
  
  return result;
}

/**
 * Layer 3: Domestic Rendering
 * Simplified Chinese, Big-to-Small, No Translation.
 */
export function renderDomesticCN(details: any): string {
  const c = canonicalizeCN(details);
  const parts = [
    c.postcode ? c.postcode : "",
    c.state,
    c.city,
    c.district,
    c.subdistrict,
    c.road,
    c.house_number ? `${c.house_number}号` : "",
    c.building,
    c.amenity || c.shop
  ].filter(Boolean);
  
  return parts.join("");
}

/**
 * Layer 4: International Rendering
 * Pinyin + Shipping English Dictionary.
 */
export function renderInternationalCN(details: any): string {
  const c = canonicalizeCN(details);
  
  const translateField = (text: string, isMajorInternal?: boolean) => {
    if (!text) return "";
    let processed = text;
    
    // Apply Shipping Dictionary
    Object.entries(SHIPPING_ENGLISH_DICT).forEach(([zh, en]) => {
      if (processed.includes(zh)) {
        processed = processed.replace(zh, en ? ` ${en}` : "");
      }
    });
    
    // Pinyin-ify remaining characters
    // We use pinyin-pro for better accuracy
    const result = pinyin(processed, { toneType: 'none' })
      .split(' ')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
      
    return result.trim();
  };

  const parts = [
    translateField(c.building),
    translateField(c.road),
    c.house_number ? `No.${c.house_number}` : "",
    translateField(c.subdistrict),
    translateField(c.district),
    translateField(c.city),
    translateField(c.state),
    c.postcode,
    "CHINA"
  ].filter(Boolean);
  
  return parts.join(", ");
}

/**
 * Traditional Chinese Regions specialized logic
 */
export function renderTW(details: any, lang: string): string {
  const isDomestic = lang.startsWith('zh-Hant') || lang === 'local';
  if (isDomestic) {
    const parts = [
      details.postcode,
      details.state, // City/County
      details.city,  // District
      details.subdistrict,
      details.road,
      details.house_number ? `${details.house_number}號` : "",
      details.building
    ].filter(Boolean);
    return parts.join("");
  } else {
    // International TW
    return pinyin(details.state + details.city, { toneType: 'none' }) + ", TAIWAN";
  }
}

export function renderHK(details: any, lang: string): string {
  const isEnglish = lang === 'en' || lang === 'international';
  if (isEnglish) {
    // HK English Canonical (Small-to-Big)
    const parts = [
      details.building,
      details.house_number && details.road ? `${details.house_number} ${details.road}` : (details.house_number || details.road),
      details.subdistrict,
      details.city || details.district, // Kowloon, Hong Kong Island, etc.
      "HONG KONG"
    ].filter(Boolean);
    return parts.join(", ").toUpperCase();
  } else {
    // HK Traditional (Can handle local, zh-Hant, or specific zh-Hant-HK)
    const parts = [
      details.city || details.district,
      details.subdistrict,
      details.road,
      details.house_number ? `${details.house_number}號` : "",
      details.building
    ].filter(Boolean);
    return "香港 " + parts.join("");
  }
}

export function renderMO(details: any, lang: string): string {
  const isEnglish = lang === 'en' || lang === 'international';
  const isPortuguese = lang === 'pt-PT' || lang === 'pt';
  
  if (isPortuguese || isEnglish) {
    // Macau Portuguese/English (often uses Rua instead of Rd)
    const parts = [
      details.building,
      details.house_number && details.road ? `${details.house_number} ${details.road}` : (details.house_number || details.road),
      details.subdistrict,
      "MACAU"
    ].filter(Boolean);
    return parts.join(", ").toUpperCase();
  } else {
    // Macau Chinese
    const parts = [
      details.subdistrict,
      details.road,
      details.house_number ? `${details.house_number}號` : "",
      details.building
    ].filter(Boolean);
    return "澳門 " + parts.join("");
  }
}
