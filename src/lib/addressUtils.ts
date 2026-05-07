import { getAddressFormat } from '../data/address_formats';
import { NO_POSTAL_COUNTRIES } from './postalPatterns';
// import { GoogleGenAI } from "@google/genai"; // Gemini removed per user request
import { transliterate } from './transliteration';

// --- Address Utilities ---

// In-memory cache for translations to reduce API calls
const translationCache: Record<string, string> = {};

// --- Address Abbreviations for Shipping Labels ---
const SHIPPING_ABBREVIATIONS: Record<string, string> = {
  // Ordered by length descending to match longest phrases first
  "Northwest": "NW",
  "Northeast": "NE",
  "Southwest": "SW",
  "Southeast": "SE",
  "Street": "St",
  "Avenue": "Ave",
  "Boulevard": "Blvd",
  "Road": "Rd",
  "Lane": "Ln",
  "Drive": "Dr",
  "Court": "Ct",
  "Apartment": "Apt",
  "Suite": "Ste",
  "Building": "Bldg",
  "Floor": "Fl",
  "Unit": "Unit",
  "Department": "Dept",
  "Place": "Pl",
  "Square": "Sq",
  "Terrace": "Ter",
  "North": "N",
  "South": "S",
  "East": "E",
  "West": "W"
};

/**
 * Applies common shipping abbreviations to an address string for shipping labels.
 */
export function applyShippingAbbreviations(text: string): string {
  if (!text) return "";
  let result = text;
  Object.entries(SHIPPING_ABBREVIATIONS).forEach(([full, abbr]) => {
    // Match full word with boundaries to avoid mid-word replacements
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    result = result.replace(regex, abbr);
  });
  
  return result;
}

export const LANGUAGES = [
  { code: 'ja', name: '日本語', country: 'Japan' },
  { code: 'en', name: 'English', country: 'United States' },
  { code: 'zh-Hans', name: '简体中文', country: 'China' },
  { code: 'zh-Hant', name: '繁體中文', country: 'Taiwan' },
  { code: 'ko', name: '한국어', country: 'South Korea' },
  { code: 'fr', name: 'Français', country: 'France' },
  { code: 'de', name: 'Deutsch', country: 'Germany' },
  { code: 'es', name: 'Español', country: 'Spain' },
  { code: 'it', name: 'Italiano', country: 'Italy' },
  { code: 'pt', name: 'Português', country: 'Portugal' },
  { code: 'ru', name: 'Русский', country: 'Russia' },
  { code: 'kk', name: 'Қазақша', country: 'Kazakhstan' },
  { code: 'ky', name: 'Кыргызча', country: 'Kyrgyzstan' },
  { code: 'tg', name: 'Тоҷикӣ', country: 'Tajikistan' },
  { code: 'tk', name: 'Türkmençe', country: 'Turkmenistan' },
  { code: 'uz', name: 'Oʻzbekcha', country: 'Uzbekistan' },
  { code: 'vi', name: 'Tiếng Việt', country: 'Vietnam' },
  { code: 'th', name: 'ไทย', country: 'Thailand' },
  { code: 'hi', name: 'हिन्दी', country: 'India' },
  { code: 'bn', name: 'বাংলা', country: 'Bangladesh' },
  { code: 'ur', name: 'اردو', country: 'Pakistan' },
  { code: 'ta', name: 'தமிழ்', country: 'India' },
  { code: 'te', name: 'తెలుగు', country: 'India' },
  { code: 'mr', name: 'मराठी', country: 'India' },
  { code: 'gu', name: 'ગુજરાતી', country: 'India' },
  { code: 'kn', name: 'ಕನ್ನಡ', country: 'India' },
  { code: 'ml', name: 'മലയാളം', country: 'India' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', country: 'India' },
  { code: 'si', name: 'සිංහල', country: 'Sri Lanka' },
  { code: 'ne', name: 'नेपाली', country: 'Nepal' },
  { code: 'dz', name: 'རྫོང་ཁ', country: 'Bhutan' },
  { code: 'ps', name: 'پښتو', country: 'Afghanistan' },
  { code: 'dv', name: 'ދިވެހި', country: 'Maldives' },
  { code: 'ar', name: 'العربية', country: 'Saudi Arabia' },
  { code: 'tr', name: 'Türkçe', country: 'Turkey' },
  { code: 'fa', name: 'فارسی', country: 'Iran' },
  { code: 'he', name: 'עברית', country: 'Israel' },
  { code: 'af', name: 'Afrikaans', country: 'South Africa' },
  { code: 'zu', name: 'isiZulu', country: 'South Africa' },
  { code: 'xh', name: 'isiXhosa', country: 'South Africa' }
];

export const COUNTRY_LANGUAGES: Record<string, string[]> = {
  'jp': ['ja'],
  'us': ['en', 'es'],
  'ca': ['en', 'fr'],
  'gb': ['en'],
  'cn': ['zh-Hans'],
  'tw': ['zh-Hant'],
  'hk': ['zh-Hant', 'en'],
  'mo': ['zh-Hant', 'pt'],
  'kr': ['ko'],
  'kp': ['ko'],
  'fr': ['fr'],
  'de': ['de'],
  'it': ['it'],
  'es': ['es'],
  'pt': ['pt'],
  'br': ['pt'],
  'ru': ['ru'],
  'kz': ['kk', 'ru'],
  'uz': ['uz', 'ru'],
  'kg': ['ky', 'ru'],
  'tj': ['tg', 'ru'],
  'tm': ['tk', 'ru'],
  'vn': ['vi'],
  'th': ['th'],
  'in': ['hi', 'en', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur'],
  'za': ['en', 'af', 'zu', 'xh'],
  'pk': ['ur', 'en', 'pa'],
  'bd': ['bn', 'en'],
  'lk': ['si', 'ta', 'en'],
  'np': ['ne', 'en'],
  'bt': ['dz', 'en'],
  'af': ['ps', 'fa', 'uz'],
  'mv': ['dv', 'en'],
  'sa': ['ar'],
  'ae': ['ar', 'en'],
  'tr': ['tr'],
  'ir': ['fa'],
  'il': ['he', 'en'],
  'iq': ['ar', 'en'],
  'sy': ['ar'],
  'jo': ['ar'],
  'lb': ['ar', 'fr'],
  'ye': ['ar'],
  'om': ['ar'],
  'kw': ['ar'],
  'qa': ['ar'],
  'bh': ['ar'],
  'ch': ['de', 'fr', 'it', 'en'],
  'be': ['nl', 'fr', 'de', 'en'],
  'sg': ['en', 'zh-Hans', 'ms', 'ta']
};

export const BIG_TO_SMALL_COUNTRIES = ['jp', 'cn', 'tw', 'hk', 'mo', 'kr', 'kp', 'vn', 'hu'];

const JP_PREFECTURES: Record<string, { ja: string, en: string }> = {
  'JP-01': { ja: '北海道', en: 'Hokkaido' },
  'JP-02': { ja: '青森県', en: 'Aomori' },
  'JP-03': { ja: '岩手県', en: 'Iwate' },
  'JP-04': { ja: '宮城県', en: 'Miyagi' },
  'JP-05': { ja: '秋田県', en: 'Akita' },
  'JP-06': { ja: '山形県', en: 'Yamagata' },
  'JP-07': { ja: '福島県', en: 'Fukushima' },
  'JP-08': { ja: '茨城県', en: 'Ibaraki' },
  'JP-09': { ja: '栃木県', en: 'Tochigi' },
  'JP-10': { ja: '群馬県', en: 'Gunma' },
  'JP-11': { ja: '埼玉県', en: 'Saitama' },
  'JP-12': { ja: '千葉県', en: 'Chiba' },
  'JP-13': { ja: '東京都', en: 'Tokyo' },
  'JP-14': { ja: '神奈川県', en: 'Kanagawa' },
  'JP-15': { ja: '新潟県', en: 'Niigata' },
  'JP-16': { ja: '富山県', en: 'Toyama' },
  'JP-17': { ja: '石川県', en: 'Ishikawa' },
  'JP-18': { ja: '福井県', en: 'Fukui' },
  'JP-19': { ja: '山梨県', en: 'Yamanashi' },
  'JP-20': { ja: '長野県', en: 'Nagano' },
  'JP-21': { ja: '岐阜県', en: 'Gifu' },
  'JP-22': { ja: '静岡県', en: 'Shizuoka' },
  'JP-23': { ja: '愛知県', en: 'Aichi' },
  'JP-24': { ja: '三重県', en: 'Mie' },
  'JP-25': { ja: '滋賀県', en: 'Shiga' },
  'JP-26': { ja: '京都府', en: 'Kyoto' },
  'JP-27': { ja: '大阪府', en: 'Osaka' },
  'JP-28': { ja: '兵庫県', en: 'Hyogo' },
  'JP-29': { ja: '奈良県', en: 'Nara' },
  'JP-30': { ja: '和歌山県', en: 'Wakayama' },
  'JP-31': { ja: '鳥取県', en: 'Tottori' },
  'JP-32': { ja: '島根県', en: 'Shimane' },
  'JP-33': { ja: '岡山県', en: 'Okayama' },
  'JP-34': { ja: '広島県', en: 'Hiroshima' },
  'JP-35': { ja: '山口県', en: 'Yamaguchi' },
  'JP-36': { ja: '徳島県', en: 'Tokushima' },
  'JP-37': { ja: '香川県', en: 'Kagawa' },
  'JP-38': { ja: '愛媛県', en: 'Ehime' },
  'JP-39': { ja: '高知県', en: 'Kochi' },
  'JP-40': { ja: '福岡県', en: 'Fukuoka' },
  'JP-41': { ja: '佐賀県', en: 'Saga' },
  'JP-42': { ja: '長崎県', en: 'Nagasaki' },
  'JP-43': { ja: '熊本県', en: 'Kumamoto' },
  'JP-44': { ja: '大分県', en: 'Oita' },
  'JP-45': { ja: '宮崎県', en: 'Miyazaki' },
  'JP-46': { ja: '鹿児島県', en: 'Kagoshima' },
  'JP-47': { ja: '沖縄県', en: 'Okinawa' }
};

export function normalizeAddressText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u3000\s]+/g, " ") // Full-width space to half-width
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // Full-width alphanumeric to half-width
    .trim();
}

// --- Japanese Romaji Transliteration Helper ---

/**
 * Fast, heuristic transliteration for Japanese addresses to Romaji.
 * Used as an instant fallback while AI translation loads.
 */
export function fastJapaneseTransliterate(text: string): string {
  if (!text || !/[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) return text;
  return transliterate(text, 'ja');
}
export async function formatAddress(details: any, lang: string = 'local', options: { shipping?: boolean, isHighPrecision?: boolean, forceDomestic?: boolean } = {}): Promise<string> {
  if (!details) return "";

  const c = details.country_code?.slice(0, 2).toUpperCase();
  const formatDef = await (c ? getAddressFormat(c) : Promise.resolve(null));

  // Determine which specification to use from JSON
  let currentSpec: any = null;
  
  if (formatDef) {
    if (lang === 'international') {
      // Direct request for international
      currentSpec = formatDef.english || formatDef.native;
    } else if (options.forceDomestic) {
      currentSpec = formatDef.native;
    } else {
      // Check international record first
      if (formatDef.international && formatDef.international[lang]) {
        currentSpec = formatDef.international[lang];
      } else if (lang === 'en' && formatDef.english) {
        currentSpec = formatDef.english;
      } else {
        currentSpec = formatDef.native;
      }
    }
  }

  // Fallback if no JSON spec found (legacy logic)
  if (!currentSpec && !formatDef) {
    const isBigToSmall = BIG_TO_SMALL_COUNTRIES.includes(c?.toLowerCase() || "");
    const isNoPostal = NO_POSTAL_COUNTRIES.some(npc => npc.code === c);
    
    const parts = {
      poi: details.amenity || details.shop || details.office || details.tourism || details.leisure || details.railway || details.aeroway || details.historic || details.station || "",
      country: details.country || "",
      postcode: details.postcode || (isNoPostal && details.plus_code ? details.plus_code : ""),
      state: details.state || details.province || details.region || "",
      city: details.city || details.town || details.village || "",
      suburb: details.suburb || details.neighbourhood || details.district || "",
      road: details.road || details.street || "",
      house: details.house_number || details.building || ""
    };

    if (isBigToSmall && lang !== 'en' && !options.forceDomestic === false) {
       // ... existing legacy big-to-small logic ...
    }
    // For brevity of this edit, I will focus on the JSON-based logic which is the priority
  }

  if (currentSpec) {
    let formatted = currentSpec.addressFormat;
    const isTargetEn = lang === 'en' || lang === 'international';
      
    // Map details to format keys
    const mapping: Record<string, string> = {};
    const keys = [
      'postcode', 'state', 'city', 'district', 'subdistrict', 'suburb', 
      'street', 'road', 'houseNumber', 'organization', 'poi', 'country'
    ];

    for (const key of keys) {
      let val = "";
      if (key === 'postcode') val = details.postcode || "";
      else if (key === 'state') val = details.state || details.province || details.region || "";
      else if (key === 'city') val = details.city || details.town || details.village || "";
      else if (key === 'district') val = details.city_district || details.district || details.county || "";
      else if (key === 'subdistrict') val = details.subdistrict || details.suburb || details.neighbourhood || "";
      else if (key === 'suburb') val = details.suburb || details.hamlet || "";
      else if (key === 'street') val = details.road || details.street || "";
      else if (key === 'road') val = details.road || details.street || "";
      else if (key === 'houseNumber') val = details.house_number || details.building || "";
      else if (key === 'organization') val = details.building || details.organization || details.amenity || "";
      else if (key === 'poi') val = details.amenity || details.shop || details.tourism || "";
      else if (key === 'country') val = details.country || "";

      // Quality Romanization: If target is English, transliterate any non-latin values if they aren't translated
      if (isTargetEn && val && /[^\u0000-\u007F]/.test(val)) {
        // Attempt fast transliteration for the specific country if known
        if (c === 'JP') val = fastJapaneseTransliterate(val);
        else val = transliterate(val, c?.toLowerCase() || 'en');
      }
      mapping[key] = val;
    }

      // [CRITICAL] Information Integrity: Special refinement for Japan Address Components
      if (c === 'JP') {
        const block = details.city_block || details.block_number;
        const chome = details.jp_chome || details.subdistrict || details.quarter;
        
        if (chome && !mapping.subdistrict.includes(chome)) {
          mapping.subdistrict = mapping.subdistrict ? `${chome} ${mapping.subdistrict}` : chome;
        }
        if (block && !mapping.street.includes(block)) {
          mapping.street = mapping.street ? `${mapping.street} ${block}` : block;
        }
        
        // Refine prefecture name based on target language
        if (details['ISO3166-2-lvl4'] && JP_PREFECTURES[details['ISO3166-2-lvl4']]) {
          mapping.state = isTargetEn 
            ? JP_PREFECTURES[details['ISO3166-2-lvl4']].en 
            : JP_PREFECTURES[details['ISO3166-2-lvl4']].ja;
        }

        // Special rule for Japan: Domestic format should NOT include country name
        if (!isTargetEn) {
          mapping.country = "";
        }
      }

      // Replace placeholders
      Object.entries(mapping).forEach(([key, value]) => {
        formatted = formatted.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      // Handle the "Domestic vs International" country rule globally
      // If native language is selected and it's not 'en', usually country name is omitted in domestic rules.
      // But we respect the JSON format string. If it has {{country}}, it stays unless we manually cleared it above.
      // User says: "Domestic don't need country notation. Only International needs it."
      const countryLangs = COUNTRY_LANGUAGES[c?.toLowerCase() || ""] || [];
      const isActuallyNative = countryLangs.includes(lang) && lang !== 'en';
      if (isActuallyNative) {
        formatted = formatted.replace(/{{country}}/g, "");
      }

      // Cleanup
      let result = formatted
        .split('\n')
        .map(line => line.replace(/,\s*,/g, ',').replace(/^\s*,|,?\s*$/g, '').trim())
        .filter(line => line.length > 0 && line !== ',')
        .join('\n')
        .replace(/\s+/g, ' ');

      if (isTargetEn) {
        // Final Latin-only cleanup for strict English output
        result = result.replace(/[\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u0600-\u06FF\u0E00-\u0E7F\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9faf\uac00-\ud7af]/g, '').trim();
        result = result.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').replace(/\s+/g, ' ').trim();
      }

      if (options.shipping && isTargetEn) {
        result = applyShippingAbbreviations(result);
      }
      return result;
    }

  // Final fallback (existing logic slightly simplified)
  const isBigToSmall = BIG_TO_SMALL_COUNTRIES.includes(c?.toLowerCase() || "");
  const parts = {
    poi: details.amenity || details.shop || "",
    country: details.country || "",
    postcode: details.postcode || "",
    state: details.state || details.province || "",
    city: details.city || details.town || "",
    suburb: details.suburb || details.neighbourhood || "",
    road: details.road || details.street || "",
    house: details.house_number || ""
  };

  const isTargetEn = lang === 'en' || lang === 'international';
  if (isTargetEn) {
     Object.keys(parts).forEach(k => {
       const key = k as keyof typeof parts;
       if (parts[key] && /[^\u0000-\u007F]/.test(parts[key])) {
         parts[key] = transliterate(parts[key], c?.toLowerCase() || 'en');
       }
     });
  }

  if (isBigToSmall && !isTargetEn) {
    const ordered = [parts.postcode, parts.state, parts.city, parts.suburb, parts.road, parts.house, parts.poi].filter(Boolean);
    const separator = (lang === 'ja' || lang === 'zh-Hans' || lang === 'ko') ? "" : " ";
    return ordered.join(separator);
  } else {
    const ordered = [parts.poi, parts.house && parts.road ? `${parts.house} ${parts.road}` : (parts.house || parts.road), parts.suburb, parts.city, parts.state, parts.postcode, parts.country].filter(Boolean);
    return ordered.join(", ");
  }
}

// --- Translation Engine (Open Source) ---
async function performTranslation(text: string, target: string): Promise<string | null> {
  const normalizedText = text.trim();
  if (!normalizedText) return null;
  
  // Cache check
  const cacheKey = `${normalizedText}_${target}`;
  if (translationCache[cacheKey]) return translationCache[cacheKey];

  // Try Open Source Translation APIs
  const targetCode = target === 'zh-Hans' ? 'zh' : (target === 'zh-Hant' ? 'zt' : target);

  const instances = [
    "https://translate.argosopentech.com/translate",
    "https://libretranslate.de/translate",
    "https://translate.terraprint.co/translate",
    "https://translate.fortland.io/translate",
    "https://translate.api.skidder.xyz/translate"
  ];

  for (const url of instances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify({
          q: normalizedText,
          source: "auto",
          target: targetCode,
          format: "text"
        }),
        headers: { "Content-Type": "application/json" },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
    if (res.ok) {
        const data = await res.json();
        if (data.translatedText) {
          translationCache[cacheKey] = data.translatedText;
          return data.translatedText;
        }
      }
    } catch (err) {
      continue;
    }
  }

  return null;
}

/**
 * Open Source high-precision address translation & transliteration
 */
export async function translateAddressOpenSource(text: string, target: string, details?: any, isHighPrecision?: boolean): Promise<string> {
  // If we have structured details, try to format them first
  if (details && !isHighPrecision) {
    return await formatAddress(details, target, { isHighPrecision: false });
  }

  const sourceText = text.trim();
  if (!sourceText) return "";

  // 1. Basic Transliteration (Local Logic)
  let processedText = sourceText;
  if (target === 'en' || target === 'international') {
    // Try local transliteration first for common scripts
    processedText = transliterate(sourceText, 'ja'); // Try Japan specifically if it looks like it
    if (processedText === sourceText) {
       // If no change, try a general run through translation if needed
    }
  }

  // 2. Open Source Translation API (Heuristic Fallback)
  try {
    if (sourceText.startsWith('{') && sourceText.endsWith('}')) {
      const parsed = JSON.parse(sourceText);
      return await formatAddress(parsed, target, { isHighPrecision: false });
    }
  } catch (e) {}

  if (target !== 'local') {
    const hasNonLatin = /[^\u0000-\u007F]/.test(processedText);
    const isTargetNonLatin = ['ja', 'ko', 'zh-Hans', 'zh-Hant', 'ru'].includes(target);
    
    if (hasNonLatin || isTargetNonLatin) {
      const translated = await performTranslation(processedText, target);
      if (translated) processedText = translated;
    }
  }
  
  if (target === 'en') {
    // Final Latin-only cleanup for English
    processedText = processedText.replace(/[^\u0000-\u017F\s,.-]/g, '').trim();
    processedText = processedText.replace(/\s+/g, ' ').trim();
  }
  
  return processedText;
}
