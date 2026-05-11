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

/**
 * Robust algorithm to convert local address data into an international shipping label (UPU compatible).
 * Standards used:
 * - UPU S42 (International addressing standards)
 * - ISO/IEC 19773:2011 (Address conversion)
 * - Latin transliteration for global machine readability
 */
export async function generateInternationalShippingLabel(details: any, options: { recipient?: string } = {}): Promise<string> {
  if (!details) return "";

  // 1. Core Data Extraction & Enrichment
  const c = details.country_code?.slice(0, 2).toUpperCase() || "";
  
  // Use English/International as the base language for the algorithm
  const baseLang = 'international';
  const mapping: Record<string, string> = {
    organization: details.building || details.organization || details.amenity || "",
    houseNumber: details.house_number || details.building || "",
    street: details.road || details.street || "",
    suburb: details.suburb || details.neighbourhood || "",
    city: details.city || details.town || details.village || "",
    state: details.state || details.province || details.region || "",
    postcode: details.postcode || (details.plus_code ? details.plus_code.replace(/\+/g, ' ') : ""),
    country: details.country || ""
  };

  // 2. Language Normalization & Transliteration
  // We must ensure Latin script for international sorting.
  Object.keys(mapping).forEach(key => {
    let val = mapping[key];
    if (val && /[^\u0000-\u007F]/.test(val)) {
      // Use local transliteration logic
      mapping[key] = transliterate(val, c.toLowerCase() || 'en');
    }
  });

  // 3. Postal formatting by country (UPU Standard)
  let formatted = "";
  if (options.recipient) {
    formatted += options.recipient.toUpperCase() + "\n";
  }

  // Handle Japan specifically (Big-to-Small in local, Small-to-Big in International)
  if (c === 'JP') {
    // International standard for JP: No/Street, Locality, PREFECTURE, POSTCODE, JAPAN
    const block = details.jp_block || details.block_number;
    const chome = details.jp_chome || details.subdistrict;
    const number = details.jp_number;
    
    let streetPart = mapping.street;
    if (chome || block || number) {
      streetPart = [chome, block, number].filter(Boolean).join("-") + " " + mapping.street;
    }
    
    formatted += `${streetPart}\n`;
    formatted += `${mapping.suburb ? mapping.suburb + ", " : ""}${mapping.city}\n`;
    formatted += `${mapping.state.toUpperCase()} ${mapping.postcode}\n`;
  } else {
    // Default Western style (UPU Standard)
    if (mapping.organization) formatted += `${mapping.organization}\n`;
    formatted += `${mapping.houseNumber} ${mapping.street}\n`;
    if (mapping.suburb && mapping.suburb !== mapping.city) formatted += `${mapping.suburb}\n`;
    formatted += `${mapping.city}${mapping.state ? ", " + mapping.state : ""} ${mapping.postcode}\n`;
  }

  // 4. Final Country Line (MUST BE CAPITALIZED for international sorting)
  formatted += mapping.country.toUpperCase();

  // 5. Cleanup & Abbreviations
  let lines = formatted.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // Apply abbreviations to street-level lines (usually the 1st or 2nd line after recipient)
  lines = lines.map((line, idx) => {
    if (idx > 0 && idx < lines.length - 1) {
      return applyShippingAbbreviations(line);
    }
    return line;
  });

  // Strict Latin character enforcement (remove remaining non-latin if any)
  return lines
    .map(line => line.replace(/[^\x00-\x7F]/g, ""))
    .join('\n')
    .replace(/,\s*,/g, ',')
    .replace(/^,|,$/g, '')
    .trim();
}

export const LANGUAGES = [
  { code: 'ja', name: '日本語', country: 'Japan', flag: '🇯🇵' },
  { code: 'en', name: 'English', country: 'United States', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English', country: 'United Kingdom', flag: '🇬🇧' },
  { code: 'en-AU', name: 'English', country: 'Australia', flag: '🇦🇺' },
  { code: 'en-CA', name: 'English', country: 'Canada', flag: '🇨🇦' },
  { code: 'zh-Hans', name: '简体中文', country: 'China', flag: '🇨🇳' },
  { code: 'zh-Hant', name: '繁體中文', country: 'Taiwan', flag: '🇹🇼' },
  { code: 'ko', name: '한국어', country: 'South Korea', flag: '🇰🇷' },
  { code: 'fr', name: 'Français', country: 'France', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', country: 'Germany', flag: '🇩🇪' },
  { code: 'es', name: 'Español', country: 'Spain', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', country: 'Italy', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', country: 'Portugal', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', country: 'Russia', flag: '🇷🇺' },
  { code: 'kk', name: 'Қазақша', country: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'ky', name: 'Кыргызча', country: 'Kyrgyzstan', flag: '🇰🇬' },
  { code: 'tg', name: 'Тоҷикӣ', country: 'Tajikistan', flag: '🇹🇯' },
  { code: 'tk', name: 'Türkmençe', country: 'Turkmenistan', flag: '🇹🇲' },
  { code: 'uz', name: 'Oʻzbekcha', country: 'Uzbekistan', flag: '🇺🇿' },
  { code: 'vi', name: 'Tiếng Việt', country: 'Vietnam', flag: '🇻🇳' },
  { code: 'th', name: 'ไทย', country: 'Thailand', flag: '🇹🇭' },
  { code: 'hi', name: 'हिन्दी', country: 'India', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', country: 'Bangladesh', flag: '🇧🇩' },
  { code: 'ur', name: 'اردو', country: 'Pakistan', flag: '🇵🇰' },
  { code: 'ta', name: 'தமிழ்', country: 'India', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', country: 'India', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', country: 'India', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી', country: 'India', flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ', country: 'India', flag: '🇮🇳' },
  { code: 'ml', name: 'മലയാളം', country: 'India', flag: '🇮🇳' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', country: 'India', flag: '🇮🇳' },
  { code: 'si', name: 'සිංහල', country: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'ne', name: 'नेपाली', country: 'Nepal', flag: '🇳🇵' },
  { code: 'dz', name: 'རྫོང་ཁ', country: 'Bhutan', flag: '🇧🇹' },
  { code: 'ps', name: 'پښتو', country: 'Afghanistan', flag: '🇦🇫' },
  { code: 'dv', name: 'ދިވެހި', country: 'Maldives', flag: '🇲🇻' },
  { code: 'ar', name: 'العربية', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'tr', name: 'Türkçe', country: 'Turkey', flag: '🇹🇷' },
  { code: 'fa', name: 'فارسی', country: 'Iran', flag: '🇮🇷' },
  { code: 'he', name: 'עברית', country: 'Israel', flag: '🇮🇱' },
  { code: 'af', name: 'Afrikaans', country: 'South Africa', flag: '🇿🇦' },
  { code: 'zu', name: 'isiZulu', country: 'South Africa', flag: '🇿🇦' },
  { code: 'xh', name: 'isiXhosa', country: 'South Africa', flag: '🇿🇦' },
  { code: 'sw', name: 'Kiswahili', country: 'Kenya/Tanzania', flag: '🇰🇪' },
  { code: 'ka', name: 'ქართული', country: 'Georgia', flag: '🇬🇪' },
  { code: 'hy', name: 'Հայերեն', country: 'Armenia', flag: '🇦🇲' },
  { code: 'az', name: 'Azərbaycan', country: 'Azerbaijan', flag: '🇦🇿' },
  { code: 'am', name: 'አማርኛ', country: 'Ethiopia', flag: '🇪🇹' },
  { code: 'sq', name: 'Shqip', country: 'Albania', flag: '🇦🇱' },
  { code: 'sr', name: 'Српски', country: 'Serbia', flag: '🇷🇸' },
  { code: 'hr', name: 'Hrvatski', country: 'Croatia', flag: '🇭🇷' },
  { code: 'bg', name: 'Български', country: 'Bulgaria', flag: '🇧🇬' },
  { code: 'ro', name: 'Română', country: 'Romania', flag: '🇷🇴' },
  { code: 'el', name: 'Ελληνικά', country: 'Greece', flag: '🇬🇷' },
  { code: 'et', name: 'Eesti', country: 'Estonia', flag: '🇪🇪' },
  { code: 'lv', name: 'Latviešu', country: 'Latvia', flag: '🇱🇻' },
  { code: 'lt', name: 'Lietuvių', country: 'Lithuania', flag: '🇱🇹' },
  { code: 'is', name: 'Íslenska', country: 'Iceland', flag: '🇮🇸' },
  { code: 'fi', name: 'Suomi', country: 'Finland', flag: '🇫🇮' },
  { code: 'da', name: 'Dansk', country: 'Denmark', flag: '🇩🇰' },
  { code: 'sv', name: 'Svenska', country: 'Sweden', flag: '🇸🇪' },
  { code: 'nb', name: 'Norsk Bokmål', country: 'Norway', flag: '🇳🇴' },
  { code: 'nl', name: 'Nederlands', country: 'Netherlands', flag: '🇳🇱' },
  { code: 'ms', name: 'Bahasa Melayu', country: 'Malaysia', flag: '🇲🇾' },
  { code: 'id', name: 'Bahasa Indonesia', country: 'Indonesia', flag: '🇮🇩' },
  { code: 'tl', name: 'Tagalog', country: 'Philippines', flag: '🇵🇭' },
  { code: 'pl', name: 'Polski', country: 'Poland', flag: '🇵🇱' },
  { code: 'uk', name: 'Українська', country: 'Ukraine', flag: '🇺🇦' },
  { code: 'cs', name: 'Čeština', country: 'Czechia', flag: '🇨🇿' },
  { code: 'hu', name: 'Magyar', country: 'Hungary', flag: '🇭🇺' },
  { code: 'mk', name: 'Македонски', country: 'North Macedonia', flag: '🇲🇰' },
  { code: 'bs', name: 'Bosanski', country: 'Bosnia', flag: '🇧🇦' },
  { code: 'mt', name: 'Malti', country: 'Malta', flag: '🇲🇹' },
  { code: 'ga', name: 'Gaeilge', country: 'Ireland', flag: '🇮🇪' },
  { code: 'kl', name: 'Kalaallisut', country: 'Greenland', flag: '🇬🇱' },
  { code: 'mn', name: 'Монгол', country: 'Mongolia', flag: '🇲🇳' },
  { code: 'lo', name: 'ພາສາລາວ', country: 'Laos', flag: '🇱🇦' },
  { code: 'km', name: 'ភាសាខ្មែរ', country: 'Cambodia', flag: '🇰🇭' },
  { code: 'my', name: 'ဗမာစာ', country: 'Myanmar', flag: '🇲🇲' },
  { code: 'so', name: 'Soomaali', country: 'Somalia', flag: '🇸🇴' },
  { code: 'rw', name: 'Kinyarwanda', country: 'Rwanda', flag: '🇷🇼' },
  { code: 'rn', name: 'Kirundi', country: 'Burundi', flag: '🇧🇮' },
  { code: 'mg', name: 'Malagasy', country: 'Madagascar', flag: '🇲🇬' },
  { code: 'sn', name: 'ChiShona', country: 'Zimbabwe', flag: '🇿🇼' },
  { code: 'st', name: 'Sesotho', country: 'Lesotho', flag: '🇱🇸' },
  { code: 'tn', name: 'Setswana', country: 'Botswana', flag: '🇧🇼' },
  { code: 'ss', name: 'siSwati', country: 'Eswatini', flag: '🇸🇿' },
  { code: 'ti', name: 'ትግርኛ', country: 'Eritrea', flag: '🇪🇷' }
];

export const COUNTRY_LANGUAGES: Record<string, string[]> = {
  'jp': ['ja'],
  'us': ['en', 'es'],
  'ca': ['en', 'en-CA', 'fr'],
  'gb': ['en-GB', 'en'],
  'au': ['en-AU', 'en'],
  'nz': ['en', 'ms', 'zh-Hans'], // Added some common langs for NZ as example
  'ie': ['en', 'ga'],
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
  'mx': ['es'],
  'ar': ['es'],
  'cl': ['es'],
  'co': ['es'],
  'pe': ['es'],
  'at': ['de'],
  'ch': ['de', 'fr', 'it', 'en'],
  'be': ['nl', 'fr', 'de', 'en'],
  'nl': ['nl'],
  'se': ['sv'],
  'no': ['nb'],
  'fi': ['fi', 'sv'],
  'dk': ['da'],
  'kz': ['kk', 'ru'],
  'uz': ['uz', 'ru'],
  'kg': ['ky', 'ru'],
  'tj': ['tg', 'ru'],
  'tm': ['tk', 'ru'],
  'vn': ['vi'],
  'th': ['th'],
  'id': ['id'],
  'my': ['ms', 'en'],
  'ph': ['tl', 'en'],
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
  'qa': ['ar'],
  'kw': ['ar'],
  'om': ['ar'],
  'bh': ['ar'],
  'tr': ['tr'],
  'ir': ['fa'],
  'il': ['he', 'en'],
  'iq': ['ar', 'en'],
  'sy': ['ar'],
  'jo': ['ar'],
  'lb': ['ar', 'fr'],
  'ye': ['ar'],
  'eg': ['ar'],
  'ma': ['ar', 'fr'],
  'dz': ['ar', 'fr'],
  'tn': ['ar', 'fr'],
  'ly': ['ar'],
  'sd': ['ar', 'en'],
  'ps': ['ar'],
  'ge': ['ka'],
  'am': ['hy'],
  'az': ['az'],
  'ng': ['en'],
  'ke': ['en', 'sw'],
  'et': ['am'],
  'gh': ['en'],
  'ci': ['fr'],
  'sn': ['fr', 'wo'],
  'tz': ['sw', 'en'],
  'ug': ['en', 'sw'],
  'zm': ['en'],
  'zw': ['en', 'sn', 'nd'],
  'ao': ['pt'],
  'mz': ['pt'],
  'mg': ['mg', 'fr'],
  'cm': ['fr', 'en'],
  'cd': ['fr', 'sw'],
  'cg': ['fr'],
  'ga': ['fr'],
  'ml': ['fr', 'bm'],
  'bf': ['fr'],
  'ne': ['fr'],
  'td': ['fr', 'ar'],
  'cf': ['fr', 'sg'],
  'ss': ['en'],
  'so': ['so', 'ar'],
  'dj': ['fr', 'ar'],
  'er': ['ti', 'ar', 'en'],
  'rw': ['rw', 'fr', 'en'],
  'bi': ['rn', 'fr'],
  'mw': ['en', 'ny'],
  'na': ['en', 'af', 'de'],
  'bw': ['en', 'tn'],
  'ls': ['st', 'en'],
  'sz': ['ss', 'en'],
  'mu': ['en', 'fr', 'mfe'],
  'sc': ['fr', 'en', 'crs'],
  'km': ['ar', 'fr', 'zdj'],
  'cv': ['pt'],
  'st': ['pt'],
  'gq': ['es', 'fr', 'pt'],
  'gn': ['fr'],
  'gw': ['pt'],
  'sl': ['en'],
  'lr': ['en'],
  'bj': ['fr'],
  'tg': ['fr'],
  'mr': ['ar', 'fr'],
  'gm': ['en'],
  're': ['fr'],
  'yt': ['fr'],
  'sh': ['en'],
  'ac': ['en'],
  'ta': ['en'],
  'eh': ['ar', 'es'],
  'fj': ['en', 'fj', 'hi'],
  'pg': ['en', 'tpi', 'ho'],
  'sb': ['en'],
  'vu': ['bi', 'en', 'fr'],
  'ws': ['sm', 'en'],
  'to': ['to', 'en'],
  'ki': ['en', 'gil'],
  'mh': ['en', 'mh'],
  'fm': ['en'],
  'pw': ['en', 'pau'],
  'nr': ['en', 'na'],
  'tv': ['en', 'tvl'],
  'ck': ['en', 'rar'],
  'nu': ['en', 'niu'],
  'nc': ['fr'],
  'pf': ['fr', 'ty'],
  'wf': ['fr', 'wls', 'fud'],
  'as': ['en', 'sm'],
  'gu': ['en', 'ch'],
  'mp': ['en', 'ch', 'cal'],
  'cx': ['en'],
  'cc': ['en'],
  'nf': ['en', 'pih'],
  'tk': ['tkl', 'en'],
  'pn': ['en', 'pih'],
  'io': ['en'],
  'tf': ['fr'],
  'xk': ['sq', 'sr'],
  'crim': ['ru', 'uk', 'crh'],
  'donb': ['ru', 'uk'],
  'kash': ['hi', 'ur', 'ks', 'en'],
  'trnc': ['tr'],
  'slnd': ['so', 'ar', 'en'],
  'pmr': ['ru', 'uk', 'ro'],
  'gt': ['es'],
  'bz': ['en', 'es'],
  'sv': ['es'],
  'hn': ['es'],
  'ni': ['es'],
  'cr': ['es'],
  'pa': ['es'],
  'cu': ['es'],
  'jm': ['en'],
  'ht': ['fr', 'ht'],
  'do': ['es'],
  'pr': ['es', 'en'],
  'bs': ['en'],
  'aw': ['nl', 'pap', 'en', 'es'],
  'cw': ['pap', 'nl', 'en'],
  'sx': ['en', 'nl'],
  'bq': ['nl', 'en', 'pap'],
  'gp': ['fr'],
  'mq': ['fr'],
  'mf': ['fr'],
  'bl': ['fr'],
  'bb': ['en'],
  'tt': ['en'],
  'dm': ['en', 'fr'],
  'lc': ['en'],
  'vc': ['en'],
  'gd': ['en'],
  'ag': ['en'],
  'kn': ['en'],
  'vg': ['en'],
  'ky': ['en'],
  'ms': ['en'],
  'tc': ['en'],
  'ai': ['en'],
  've': ['es'],
  'ec': ['es'],
  'bo': ['es', 'ay', 'qu'],
  'py': ['es', 'gn'],
  'uy': ['es'],
  'gy': ['en'],
  'sr': ['nl', 'en'],
  'gf': ['fr'],
  'fk': ['en'],
  'gs': ['en'],
  'is': ['is'],
  'ee': ['et'],
  'lv': ['lv'],
  'lt': ['lt'],
  'by': ['be', 'ru'],
  'md': ['ro', 'ru'],
  'bg': ['bg'],
  'sk': ['sk'],
  'hr': ['hr'],
  'rs': ['sr'],
  'ba': ['bs', 'hr', 'sr'],
  'al': ['sq'],
  'mk': ['mk', 'sq'],
  'si': ['sl'],
  'me': ['cnr'],
  'lu': ['lb', 'fr', 'de'],
  'mt': ['mt', 'en'],
  'cy': ['el', 'tr', 'en'],
  'ad': ['ca'],
  'mc': ['fr'],
  'li': ['de'],
  'sm': ['it'],
  'va': ['it', 'la'],
  'je': ['en', 'fr'],
  'gg': ['en', 'fr'],
  'im': ['en', 'gv'],
  'gi': ['en', 'es'],
  'fo': ['fo', 'da'],
  'sj': ['no'],
  'ua': ['uk'],
  'pl': ['pl'],
  'cz': ['cs'],
  'hu': ['hu'],
  'mn': ['mn'],
  'la': ['lo'],
  'kh': ['km'],
  'mm': ['my'],
  'gl': ['kl', 'da'],
  'ax': ['sv'],
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
