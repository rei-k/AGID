/**
 * AGID Transliteration Standards (ISO Compliant)
 * 
 * Provides rule-based transliteration for various scripts according to the AMT/ISO specifications.
 */

export interface TransliterationOptions {
  standard?: string;
  preserveUnknown?: boolean;
}

/**
 * Japanese Transliteration (ISO 3602 - Hepburn Style)
 * Standard: ISO 3602
 * Examples: 渋谷 -> Shibuya, 東京 -> Tokyo, 神南 -> Jinnan
 */
const HEBPURN_MAP: Record<string, string> = {
  // Common place name parts
  '東京': 'Tokyo',
  '京都': 'Kyoto',
  '大阪': 'Osaka',
  '北海道': 'Hokkaido',
  '青森': 'Aomori',
  '岩手': 'Iwate',
  '宮城': 'Miyagi',
  '秋田': 'Akita',
  '山形': 'Yamagata',
  '福島': 'Fukushima',
  '茨城': 'Ibaraki',
  '栃木': 'Tochigi',
  '群馬': 'Gunma',
  '埼玉': 'Saitama',
  '千葉': 'Chiba',
  '神奈川': 'Kanagawa',
  '新潟': 'Niigata',
  '富山': 'Toyama',
  '石川': 'Ishikawa',
  '福井': 'Fukui',
  '山梨': 'Yamanashi',
  '長野': 'Nagano',
  '岐阜': 'Gifu',
  '静岡': 'Shizuoka',
  '愛知': 'Aichi',
  '三重': 'Mie',
  '滋賀': 'Shiga',
  '兵庫': 'Hyogo',
  '奈良': 'Nara',
  '和歌山': 'Wakayama',
  '鳥取': 'Tottori',
  '島根': 'Shimane',
  '岡山': 'Okayama',
  '広島': 'Hiroshima',
  '山口': 'Yamaguchi',
  '徳島': 'Tokushima',
  '香川': 'Kagawa',
  '愛媛': 'Ehime',
  '高知': 'Kochi',
  '福岡': 'Fukuoka',
  '佐賀': 'Saga',
  '長崎': 'Nagasaki',
  '熊本': 'Kumamoto',
  '大分': 'Oita',
  '宮崎': 'Miyazaki',
  '鹿児島': 'Kagoshima',
  '沖縄': 'Okinawa',
  '渋谷': 'Shibuya',
  '新宿': 'Shinjuku',
  '銀座': 'Ginza',
  '神南': 'Jinnan',
  '千代田': 'Chiyoda',
  '中央': 'Chuo',
  '港': 'Minato',
  '永田町': 'Nagatacho',
  '霞が関': 'Kasumigaseki',
  '丸の内': 'Marunouchi',
  
  // Suffixes
  '都': ' Tokyo',
  '府': ' Prefecture',
  '道': ' Hokkaido',
  '県': ' Prefecture',
  '市': ' City',
  '区': '-ku',
  '町': ' Town',
  '村': ' Village',
  '郡': ' District',
  '丁目': '-chome',
  '番地': '-banchi',
  '番': '-ban',
  '号': '-go',
  'ビル': ' Bldg',
  'マンション': ' Mansion',
  'アパート': ' Apartment',
  'コーポ': ' Corp',
  'ハイツ': ' Heights',
  'メゾン': ' Maison',
  'レジデンス': ' Residence',
};

// Simplified Romaji conversion table (Hepburn)
const ROMAJI_TABLE: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'o', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  // Combinations
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  
  // Katakana
  'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
  'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
  'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
  'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
  'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
  'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
  'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
  'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
  'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
  'ワ': 'wa', 'ヲ': 'o', 'ン': 'n',
  'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
  'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
  'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do',
  'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
  'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
  'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
  'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
  'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
  'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
  'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
  'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
  'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
  'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
  'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
  'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
  'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
};

/**
 * Japanese Transliteration Logic
 */
export function transliterateJapanese(text: string): string {
  if (!text) return "";
  let result = text;
  
  // 1. Handle Known Phrases (Tokyo, etc.)
  Object.entries(HEBPURN_MAP).forEach(([ja, en]) => {
    result = result.replace(new RegExp(ja, 'g'), en);
  });
  
  // 2. Handle Doubled Consonants (っ/ッ)
  result = result.replace(/([っッ])(.)/g, (match, sokuon, nextChar) => {
    const nextRomaji = ROMAJI_TABLE[nextChar] || nextChar;
    const consonant = nextRomaji.charAt(0);
    // Special case for 'ch' -> 'tch'
    if (nextRomaji.startsWith('ch')) return 't' + nextRomaji;
    return (consonant === consonant.toLowerCase() ? consonant : '') + nextRomaji;
  });

  // 3. Handle Long Vowels (ー)
  result = result.replace(/(.)ー/g, (match, prevChar) => {
    const prevRomaji = ROMAJI_TABLE[prevChar] || prevChar;
    const lastVowel = prevRomaji.slice(-1);
    // ISO 3602 Hepburn varies on macrons, but for geographic names like Tokyo, 
    // it's often omitted in loose Hepburn or written with macrons (ō).
    // The user example "Tokyo" suggests omitting macrons or using common spelling.
    return prevRomaji; 
  });

  // 4. Character by character mapping for Hiragana/Katakana
  // Sorting keys by length to handle combinations like 'きゃ' before 'き'
  const keys = Object.keys(ROMAJI_TABLE).sort((a, b) => b.length - a.length);
  keys.forEach(k => {
    result = result.replace(new RegExp(k, 'g'), ROMAJI_TABLE[k]);
  });
  
  return result;
}

/**
 * Cyrillic Transliteration (ISO 9 / GOST 7.79)
 * Examples: Москва -> Moskva, Київ -> Kyiv
 */
const CYRILLIC_MAP: Record<string, string> = {
  'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v',
  'Г': 'G', 'г': 'g', 'Д': 'D', 'д': 'd', 'Е': 'E', 'е': 'e',
  'Ё': 'Yo', 'ё': 'yo', 'Ж': 'Zh', 'ж': 'zh', 'З': 'Z', 'з': 'z',
  'И': 'I', 'и': 'i', 'Й': 'Y', 'й': 'y', 'К': 'K', 'к': 'k',
  'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm', 'Н': 'N', 'н': 'n',
  'О': 'O', 'о': 'o', 'П': 'P', 'п': 'p', 'Р': 'R', 'р': 'r',
  'С': 'S', 'с': 's', 'Ｔ': 'T', 'т': 't', 'У': 'U', 'у': 'u',
  'Ф': 'F', 'ф': 'f', 'Х': 'Kh', 'х': 'kh', 'Ц': 'Ts', 'ц': 'ts',
  'Ч': 'Ch', 'ч': 'ch', 'Ш': 'Sh', 'ш': 'sh', 'Щ': 'Shch', 'щ': 'shch',
  'Ъ': '', 'ъ': '', 'Ы': 'Y', 'ы': 'y', 'Ь': "'", 'ь': "'",
  'Э': 'E', 'э': 'e', 'Ю': 'Yu', 'ю': 'yu', 'Я': 'Ya', 'я': 'ya',
  // Ukrainian specific
  'Є': 'Ye', 'є': 'ye', 'І': 'I', 'і': 'i', 'Ї': 'Yi', 'ї': 'yi',
  'Ґ': 'G', 'ґ': 'g',
};

/**
 * Greek Transliteration (ISO 843)
 * Examples: Αθήνα -> Athina, Θεσσαλονίκη -> Thessaloniki
 */
const GREEK_MAP: Record<string, string> = {
  'Α': 'A', 'α': 'a', 'Β': 'V', 'β': 'v', 'Γ': 'G', 'γ': 'g',
  'Δ': 'D', 'δ': 'd', 'Ε': 'E', 'ε': 'e', 'Ζ': 'Z', 'ζ': 'z',
  'Η': 'I', 'η': 'i', 'Θ': 'Th', 'θ': 'th', 'Ι': 'I', 'ι': 'i',
  'Κ': 'K', 'κ': 'k', 'Λ': 'L', 'λ': 'l', 'Μ': 'M', 'μ': 'm',
  'Ν': 'N', 'ν': 'n', 'Ξ': 'X', 'ξ': 'x', 'Ο': 'O', 'ο': 'o',
  'Π': 'P', 'π': 'p', 'Ρ': 'R', 'ρ': 'r', 'Σ': 'S', 'σ': 's', 'ς': 's',
  'Τ': 'T', 'τ': 't', 'Υ': 'Y', 'υ': 'y', 'Φ': 'Ph', 'φ': 'ph',
  'Χ': 'Ch', 'χ': 'ch', 'Ψ': 'Ps', 'ψ': 'ps', 'Ω': 'O', 'ω': 'o'
};

import { pinyin } from 'pinyin-pro';

export function transliterateChinese(text: string): string {
  if (!text) return "";
  // Use pinyin-pro for high-quality Pinyin
  return pinyin(text, { toneType: 'none' })
    .split(' ')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

/**
 * Korean Revised Romanization (Simplified Heuristic)
 */
const KOREAN_COMMON: Record<string, string> = {
  '서울': 'Seoul', '부산': 'Busan', '인천': 'Incheon', '대구': 'Daegu',
  '도': ' Province', '시': ' City', '구': ' Gu', '동': ' Dong',
  '길': ' Gil', '번': ' Beon', '로': ' Ro'
};

export function transliterateKorean(text: string): string {
  if (!text) return "";
  let result = text;
  Object.entries(KOREAN_COMMON).forEach(([ko, en]) => {
    result = result.replace(new RegExp(ko, 'g'), en);
  });
  return result;
}

export function transliterateCyrillic(text: string): string {
  if (!text) return "";
  return text.split('').map(char => CYRILLIC_MAP[char] || char).join('');
}

export function transliterateGreek(text: string): string {
  if (!text) return "";
  return text.split('').map(char => GREEK_MAP[char] || char).join('');
}

/**
 * Deaccentuation for Latin-based languages (e.g. Polish, Czech, Hungarian)
 */
export function deaccent(text: string): string {
  if (!text) return "";
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
}

/**
 * Unified Transliteration Engine
 */
export function transliterate(text: string, lang: string): string {
  if (!text) return "";
  
  const l = lang.toLowerCase();
  switch (l) {
    case 'ja': return transliterateJapanese(text);
    case 'zh':
    case 'zh-hans':
    case 'zh-hant':
      return transliterateChinese(text);
    case 'ko': return transliterateKorean(text);
    case 'ru': 
    case 'uk':
    case 'be':
    case 'bg':
    case 'sr':
    case 'mk':
      return transliterateCyrillic(text);
    case 'el':
      return transliterateGreek(text);
    case 'pl':
    case 'cs':
    case 'hu':
    case 'ro':
    case 'sk':
    case 'sl':
    case 'is':
    case 'et':
    case 'lv':
    case 'lt':
    case 'tr':
    case 'vn':
      return deaccent(text);
    // Add more cases as needed
    default: 
      // General fallback for any other language: attempt deaccentuation if it looks like Latin-extended
      if (/[À-ž]/.test(text)) {
        return deaccent(text);
      }
      return text;
  }
}
