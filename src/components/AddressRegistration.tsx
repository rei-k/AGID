import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Search, 
  X, 
  Globe, 
  Building2, 
  Mail, 
  Map as MapIcon, 
  Navigation,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Snowflake,
  Anchor,
  Waves,
  Mountain,
  Palmtree,
  Ship,
  Sun,
  Trees,
  Fish,
  ShieldCheck as ShieldIcon,
  Landmark,
  History,
  QrCode,
  Upload,
  Camera
} from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { cn } from '../lib/utils';
import { encodeAGID, decodeAGID, calculateMountainClass, calculateConsensusMetrics } from '../lib/agid';
import { regionalReverseGeocode } from '../services/GeocodingService';
import { PolarContext } from '../services/PolarService';
import { NatureContext } from '../services/NatureService';
import { SeaContext } from '../services/SeaService';
import { HeritageContext } from '../services/HeritageService';
import { JapaneseGeoContext } from '../services/JapaneseGeoService';
import { translateAddressOpenSource, BIG_TO_SMALL_COUNTRIES, formatAddress, COUNTRY_LANGUAGES } from '../lib/addressUtils';
import { COUNTRIES } from '../constants/countries';
import { getAddressFormat, AddressFormat } from '../data/address_formats';
import { PostcodeInput } from './PostcodeInput';
import { wgs84togcj02, wgs84tobd09 } from '../lib/coordTransform';
import { lookupJapaneseZip } from '../services/JapaneseZipService';
import { generateAOID } from '../lib/aoid';

interface AddressRegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: any) => void;
  initialAgid?: string;
  initialAddress?: string;
  currentCoords?: { lat: number; lon: number };
  forceAoidMode?: boolean;
}

interface AddressMetadata {
  fmt: string;
  lfmt?: string;
  require: string;
  upper: string;
  zip_name?: string;
  state_name?: string;
  sub_name?: string;
  locality_name?: string;
  name_name?: string;
  org_name?: string;
  addr_name?: string;
  languages?: string;
  zip?: string;
  lang?: string;
}

const UI_STRINGS: Record<string, Record<string, string>> = {
  ja: {
    quickLookup: 'クイック検索',
    addressRegistration: '住所登録',
    globalAddressInput: 'グローバル住所入力 (libaddressinput)',
    registerAddress: '住所を登録する',
    countryRegion: '国 / 地域',
    phone: '電話番号',
    agid: 'AGID',
    lookupSuccess: '住所が入力されました！',
    lookupError: '検索に失敗しました',
    recipient: '氏名',
    organization: '会社・団体名',
    street: '住所',
    city: '市区町村',
    state: '都道府県',
    suburb: '町名・番地',
    postcode: '郵便番号',
    phonePlaceholder: '電話番号（国番号を含む）',
    agidPlaceholder: 'AGID（例: JP12345678）',
    postcodeLookup: '郵便番号検索',
    postcodePlaceholder: '7桁の郵便番号',
    jpAdminDetails: '日本国内行政詳細',
    prefecture: '都道府県',
    cityWard: '市区',
    townVillage: '町村',
    chome: '丁目',
    historicalName: '旧地名・歴史的名称',
    province: '省・州',
    district: '地区・郡',
    ward: '区',
    town: '町',
    village: '村',
    commune: 'コミューン',
    parish: '教区',
    quarter: 'クォーター',
    neighborhood: '近隣地域',
    governorate: '県・ガバノレート',
    emirate: '首長国',
    municipality: '自治体',
    county: '郡',
    oblast: '州 (Oblast)',
    viloyat: '州 (Viloyat)',
    region: '地域',
    department: '県 (Department)',
    canton: 'カントン',
    island: '島',
    atoll: '環礁',
    soum: 'ソム',
    bag: 'バグ',
    block: 'ブロック',
    lot: 'ロット',
    section: 'セクション',
    lane: 'レーン',
    alley: 'アレイ',
    floor: '階',
    room: '部屋',
    registerAoid: 'AOIDを生成・登録する',
    aoidTip: 'AOIDは自分だけが管理できるプライベートな住所IDです。建物名や部屋番号、連絡先を含みます。',
    registerAsAoid: 'AOIDとしてプライベート登録する',
    phoneRequired: '電話番号は必須です',
    nameRequired: '氏名は必須です'
  },
  en: {
    quickLookup: 'Quick Lookup',
    addressRegistration: 'Address Registration',
    globalAddressInput: 'Global Address Input (libaddressinput)',
    registerAddress: 'Register Address',
    countryRegion: 'Country / Region',
    phone: 'Phone',
    agid: 'AGID',
    lookupSuccess: 'Address fields populated!',
    lookupError: 'Lookup failed',
    recipient: 'Recipient Name',
    organization: 'Organization',
    street: 'Street Address',
    city: 'City / Town',
    state: 'State / Province',
    suburb: 'Suburb / District',
    postcode: 'Postal Code',
    phonePlaceholder: 'Phone Number (with country code)',
    agidPlaceholder: 'AGID (e.g. JP12345678)',
    postcodeLookup: 'Postcode Lookup',
    postcodePlaceholder: '7-digit postcode',
    jpAdminDetails: 'Japanese Administrative Details',
    prefecture: 'Prefecture',
    cityWard: 'City / Ward',
    townVillage: 'Town / Village',
    chome: 'Chome',
    historicalName: 'Historical Name',
    province: 'Province',
    district: 'District',
    ward: 'Ward',
    town: 'Town',
    village: 'Village',
    commune: 'Commune',
    parish: 'Parish',
    quarter: 'Quarter',
    neighborhood: 'Neighborhood',
    governorate: 'Governorate',
    emirate: 'Emirate',
    municipality: 'Municipality',
    county: 'County',
    oblast: 'Oblast',
    viloyat: 'Viloyat',
    region: 'Region',
    department: 'Department',
    canton: 'Canton',
    island: 'Island',
    atoll: 'Atoll',
    soum: 'Soum',
    bag: 'Bag',
    block: 'Block',
    lot: 'Lot',
    section: 'Section',
    lane: 'Lane',
    alley: 'Alley',
    floor: 'Floor',
    room: 'Room',
    registerAoid: 'Generate & Register AOID',
    aoidTip: 'AOID is a private ID containing fixed details like building, room, and phone. Not searchable by others.',
    registerAsAoid: 'Register as Private AOID',
    phoneRequired: 'Phone is required for AOID',
    nameRequired: 'Name is required for AOID'
  },
  fr: {
    quickLookup: 'Recherche Rapide',
    addressRegistration: 'Enregistrement de l\'adresse',
    globalAddressInput: 'Saisie d\'adresse globale',
    registerAddress: 'Enregistrer l\'adresse',
    countryRegion: 'Pays / Région',
    phone: 'Téléphone',
    agid: 'AGID',
    recipient: 'Nom du destinataire',
    organization: 'Organisation',
    street: 'Adresse',
    city: 'Ville',
    state: 'État / Province',
    suburb: 'Quartier',
    postcode: 'Code Postal'
  },
  zh: {
    quickLookup: '快速查询',
    addressRegistration: '地址注册',
    globalAddressInput: '全球地址输入',
    registerAddress: '注册地址',
    countryRegion: '国家 / 地区',
    phone: '电话',
    agid: 'AGID',
    recipient: '收件人姓名',
    organization: '机构',
    street: '街道地址',
    city: '城市',
    state: '省 / 州',
    suburb: '区 / 县',
    postcode: '邮政编码'
  },
  de: {
    quickLookup: 'Schnellsuche',
    addressRegistration: 'Adressregistrierung',
    globalAddressInput: 'Globale Adresseingabe',
    registerAddress: 'Adresse registrieren',
    countryRegion: 'Land / Region',
    phone: 'Telefon',
    agid: 'AGID',
    recipient: 'Empfängername',
    organization: 'Organisation',
    street: 'Straße / Hausnummer',
    city: 'Stadt',
    state: 'Bundesland / Kanton',
    suburb: 'Stadtteil',
    postcode: 'Postleitzahl'
  },
  es: {
    quickLookup: 'Búsqueda Rápida',
    addressRegistration: 'Registro de Dirección',
    globalAddressInput: 'Entrada de Dirección Global',
    registerAddress: 'Registrar Dirección',
    countryRegion: 'País / Región',
    phone: 'Teléfono',
    agid: 'AGID',
    recipient: 'Nombre del destinatario',
    organization: 'Organización',
    street: 'Calle y número',
    city: 'Ciudad',
    state: 'Estado / Provincia',
    suburb: 'Barrio / Distrito',
    postcode: 'Código Postal'
  },
  it: {
    quickLookup: 'Ricerca Rapida',
    addressRegistration: 'Registrazione Indirizzo',
    globalAddressInput: 'Inserimento Indirizzo Globale',
    registerAddress: 'Registra Indirizzo',
    countryRegion: 'Paese / Regione',
    phone: 'Telefono',
    agid: 'AGID',
    recipient: 'Nome del destinatario',
    organization: 'Organizzazione',
    street: 'Via e numero civico',
    city: 'Città',
    state: 'Provincia',
    suburb: 'Quartiere',
    postcode: 'Codice Postale'
  },
  pt: {
    quickLookup: 'Busca Rápida',
    addressRegistration: 'Registro de Endereço',
    globalAddressInput: 'Entrada de Endereço Global',
    registerAddress: 'Registrar Endereço',
    countryRegion: 'País / Região',
    phone: 'Telefone',
    agid: 'AGID',
    recipient: 'Nome do destinatário',
    organization: 'Organização',
    street: 'Rua e número',
    city: 'Cidade',
    state: 'Estado',
    suburb: 'Bairro',
    postcode: 'Código Postal'
  },
  ru: {
    quickLookup: 'Быстрый поиск',
    addressRegistration: 'Регистрация адреса',
    globalAddressInput: 'Глобальный ввод адреса',
    registerAddress: 'Зарегистрировать адрес',
    countryRegion: 'Страна / Регион',
    phone: 'Телефон',
    agid: 'AGID',
    recipient: 'Имя получателя',
    organization: 'Организация',
    street: 'Улица, дом, квартира',
    city: 'Город',
    state: 'Область / Край',
    suburb: 'Район',
    postcode: 'Почтовый индекс'
  }
};

const LANGUAGE_NAMES: Record<string, string> = {
  'local': 'Local',
  'en': 'English',
  'ja': '日本語',
  'zh': '简体中文',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  'ko': '한국어',
  'fr': 'Français',
  'de': 'Deutsch',
  'it': 'Italiano',
  'es': 'Español',
  'pt': 'Português',
  'ru': 'Русский',
  'romaji': 'Romaji',
  'no': 'Norsk',
  'da': 'Dansk',
  'fi': 'Suomi',
  'pl': 'Polski',
  'he': 'עברית',
  'el': 'Ελληνικά',
  'tl': 'Tagalog',
  'my': 'မြန်မာစာ',
  'km': 'ភាសាខ្មែរ',
  'lo': 'ພາສາລາວ',
  'ur': 'اردو',
  'bn': 'বাংলা',
  'si': 'සිංහල',
  'ne': 'नेपाली',
  'dz': 'རྫོང་ཁ་',
  'dv': 'ދިވެހި',
  'ps': 'پښتو',
  'fa': 'فارسی',
  'am': 'አማርኛ',
  'sw': 'Kiswahili',
  'uk': 'Українська',
  'cs': 'Čeština',
  'hu': 'Magyar',
  'ro': 'Română',
  'kk': 'Қазақ тілі',
  'uz': 'Oʻzbek tili',
  'kl': 'Kalaallisut',
  'fo': 'Føroyskt',
  'mn': 'Монгол хэл',
};

const COUNTRY_DEFAULT_LANGS: Record<string, string> = {
  'JP': 'ja',
  'CN': 'zh',
  'KR': 'ko',
  'TW': 'zh-Hant',
  'HK': 'zh-Hant',
  'TH': 'th',
  'VN': 'vi',
  'FR': 'fr',
  'DE': 'de',
  'IT': 'it',
  'ES': 'es',
  'RU': 'ru',
  'SA': 'ar',
  'AE': 'ar',
  'IL': 'he',
  'GR': 'el',
  'TR': 'tr',
  'NL': 'nl',
  'SE': 'sv',
  'NO': 'no',
  'DK': 'da',
  'FI': 'fi',
  'PL': 'pl',
  'PT': 'pt',
  'BR': 'pt',
  'MX': 'es',
  'AR': 'es',
  'CL': 'es',
  'CO': 'es',
  'PE': 'es',
  'MO': 'zh-Hant',
  'MN': 'mn',
  'KP': 'ko',
  'US': 'en',
  'CA': 'en',
  'GL': 'kl',
  'PM': 'fr',
  'BM': 'en',
  'GT': 'es',
  'BZ': 'en',
  'SV': 'es',
  'HN': 'es',
  'NI': 'es',
  'CR': 'es',
  'PA': 'es',
  'CU': 'es',
  'JM': 'en',
  'HT': 'fr',
  'DO': 'es',
  'PR': 'es',
  'BS': 'en',
  'BB': 'en',
  'TT': 'en',
  'VE': 'es',
  'EC': 'es',
  'BO': 'es',
  'PY': 'es',
  'UY': 'es',
  'GY': 'en',
  'SR': 'nl',
  'GF': 'fr',
  'ID': 'id',
  'MY': 'ms',
  'PH': 'tl',
  'SG': 'en',
  'MM': 'my',
  'KH': 'km',
  'LA': 'lo',
  'BN': 'ms',
  'TL': 'pt',
  'IN': 'hi',
  'PK': 'ur',
  'BD': 'bn',
  'LK': 'si',
  'NP': 'ne',
  'BT': 'dz',
  'MV': 'dv',
  'AF': 'ps',
  'ZA': 'en',
  'NG': 'en',
  'KE': 'sw',
  'EG': 'ar',
  'MA': 'ar',
  'DZ': 'ar',
  'ET': 'am',
  'GH': 'en',
  'CI': 'fr',
  'SN': 'fr',
  'TZ': 'sw',
  'UG': 'en',
  'ZM': 'en',
  'ZW': 'en',
  'AO': 'pt',
  'MZ': 'pt',
  'NA': 'en',
  'BW': 'en',
  'MU': 'en',
  'SC': 'fr',
  'KM': 'ar',
  'RE': 'fr',
  'YT': 'fr',
  'SH': 'en',
  'AC': 'en',
  'TA': 'en',
  'GS': 'en',
  'PN': 'en',
  'IO': 'en',
  'SBA': 'en',
  'MS': 'en',
  'TC': 'en',
  'AI': 'en',
  'VG': 'en',
  'KY': 'en',
  'FK': 'en',
  'JE': 'en',
  'GG': 'en',
  'IM': 'en',
  'GI': 'en',
  'BE': 'nl',
  'CH': 'de',
  'AT': 'de',
  'IE': 'en',
  'UA': 'uk',
  'CZ': 'cs',
  'HU': 'hu',
  'RO': 'ro',
  'IR': 'fa',
  'IQ': 'ar',
  'JO': 'ar',
  'LB': 'ar',
  'QA': 'ar',
  'KW': 'ar',
  'OM': 'ar',
  'KZ': 'kk',
  'UZ': 'uz',
  'AU': 'en',
  'NZ': 'en',
  'FJ': 'en',
  'PG': 'en',
  'NC': 'fr',
  'PF': 'fr',
  'GU': 'en',
  'WS': 'en',
  'SB': 'en',
  'VU': 'en',
  'TO': 'en',
  'KI': 'en',
  'MH': 'en',
  'FM': 'en',
  'PW': 'en',
  'NR': 'en',
  'TV': 'en',
  'CK': 'en',
  'NU': 'en',
  'AS': 'en',
  'MP': 'en',
  'CX': 'en',
  'CC': 'en',
  'NF': 'en',
  'TK': 'en',
  'SJ_SVA': 'no',
  'SJ_JAN': 'no',
  'ES_BAL': 'es',
  'ES_CAN': 'es',
  'PT_AZO': 'pt',
  'PT_MAD': 'pt',
  'AW': 'nl',
  'CW': 'nl',
  'SX': 'en',
  'BQ': 'nl',
  'FO': 'fo',
};

const BRITISH_TERRITORIES = [
  { code: 'GB', name: 'United Kingdom (Mainland)', flag: '🇬🇧' },
  { code: 'JE', name: 'Jersey', flag: '🇯🇪' },
  { code: 'GG', name: 'Guernsey', flag: '🇬🇬' },
  { code: 'IM', name: 'Isle of Man', flag: '🇮🇲' },
  { code: 'GI', name: 'Gibraltar', flag: '🇬🇮' },
  { code: 'BM', name: 'Bermuda', flag: '🇧🇲' },
  { code: 'FK', name: 'Falkland Islands', flag: '🇫🇰' },
  { code: 'MS', name: 'Montserrat', flag: '🇲🇸' },
  { code: 'TC', name: 'Turks and Caicos Islands', flag: '🇹🇨' },
  { code: 'VG', name: 'British Virgin Islands', flag: '🇻🇬' },
  { code: 'AI', name: 'Anguilla', flag: '🇦🇮' },
  { code: 'SH', name: 'Saint Helena', flag: '🇸🇭' },
  { code: 'AC', name: 'Ascension Island', flag: '🇦🇨' },
  { code: 'TA', name: 'Tristan da Cunha', flag: '🇹🇦' },
  { code: 'GS', name: 'South Georgia', flag: '🇬🇸' },
  { code: 'PN', name: 'Pitcairn Islands', flag: '🇵🇳' },
  { code: 'IO', name: 'British Indian Ocean Territory', flag: '🇩🇬' },
  { code: 'SBA', name: 'Sovereign Base Areas', flag: '🇨🇾' },
];

const FRENCH_TERRITORIES = [
  { code: 'FR', name: 'France (Mainland)', flag: '🇫🇷' },
  { code: 'GP', name: 'Guadeloupe', flag: '🇬🇵' },
  { code: 'MQ', name: 'Martinique', flag: '🇲🇶' },
  { code: 'GF', name: 'French Guiana', flag: '🇬🇫' },
  { code: 'RE', name: 'Réunion', flag: '🇷🇪' },
  { code: 'YT', name: 'Mayotte', flag: '🇾🇹' },
  { code: 'PF', name: 'French Polynesia', flag: '🇵🇫' },
  { code: 'NC', name: 'New Caledonia', flag: '🇳🇨' },
  { code: 'WF', name: 'Wallis and Futuna', flag: '🇼🇫' },
  { code: 'MF', name: 'Saint Martin', flag: '🇲🇫' },
  { code: 'BL', name: 'Saint Barthélemy', flag: '🇧🇱' },
  { code: 'PM', name: 'Saint Pierre and Miquelon', flag: '🇵🇲' },
  { code: 'TF', name: 'French Southern Lands', flag: '🇹🇫' },
];

const NORWEGIAN_TERRITORIES = [
  { code: 'NO', name: 'Norway (Mainland)', flag: '🇳🇴' },
  { code: 'SJ_SVA', name: 'Svalbard', flag: '❄️' },
  { code: 'SJ_JAN', name: 'Jan Mayen', flag: '🌋' },
];

const SPANISH_TERRITORIES = [
  { code: 'ES', name: 'Spain (Mainland)', flag: '🇪🇸' },
  { code: 'ES_BAL', name: 'Balearic Islands', flag: '🏝️' },
  { code: 'ES_CAN', name: 'Canary Islands', flag: '🌋' },
];

const PORTUGUESE_TERRITORIES = [
  { code: 'PT', name: 'Portugal (Mainland)', flag: '🇵🇹' },
  { code: 'PT_AZO', name: 'Azores', flag: '🐋' },
  { code: 'PT_MAD', name: 'Madeira', flag: '🍷' },
];

const DUTCH_TERRITORIES = [
  { code: 'NL', name: 'Netherlands (Mainland)', flag: '🇳🇱' },
  { code: 'AW', name: 'Aruba', flag: '🇦🇼' },
  { code: 'CW', name: 'Curaçao', flag: '🇨🇼' },
  { code: 'SX', name: 'Sint Maarten', flag: '🇸🇽' },
  { code: 'BQ', name: 'Caribbean Netherlands', flag: '🇧🇶' },
];

const DANISH_TERRITORIES = [
  { code: 'DK', name: 'Denmark (Mainland)', flag: '🇩🇰' },
  { code: 'FO', name: 'Faroe Islands', flag: '🇫🇴' },
  { code: 'GL', name: 'Greenland', flag: '🇬🇱' },
];

const AUSTRALIAN_TERRITORIES = [
  { code: 'AU', name: 'Australia (Mainland)', flag: '🇦🇺' },
  { code: 'CX', name: 'Christmas Island', flag: '🇨🇽' },
  { code: 'CC', name: 'Cocos (Keeling) Islands', flag: '🇨🇨' },
  { code: 'NF', name: 'Norfolk Island', flag: '🇳🇫' },
];

const US_TERRITORIES = [
  { code: 'US', name: 'USA (Mainland)', flag: '🇺🇸' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
  { code: 'VI', name: 'US Virgin Islands', flag: '🇻🇮' },
  { code: 'GU', name: 'Guam', flag: '🇬🇺' },
  { code: 'MP', name: 'Northern Mariana Islands', flag: '🇲🇵' },
  { code: 'AS', name: 'American Samoa', flag: '🇦🇸' },
  { code: 'UM', name: 'US Minor Outlying Islands', flag: '🇺🇲' },
];

const CHILE_TERRITORIES = [
  { code: 'CL', name: 'Chile (Mainland)', flag: '🇨🇱' },
  { code: 'CL_EA', name: 'Easter Island', flag: '🗿' },
  { code: 'CL_JF', name: 'Juan Fernández Islands', flag: '🏝️' },
  { code: 'CL_DI', name: 'Desventuradas Islands', flag: '🦅' },
  { code: 'CL_SG', name: 'Salas y Gómez Island', flag: '🌊' },
];

const NEW_ZEALAND_TERRITORIES = [
  { code: 'NZ', name: 'New Zealand (Mainland)', flag: '🇳🇿' },
  { code: 'CK', name: 'Cook Islands', flag: '🇨🇰' },
  { code: 'NU', name: 'Niue', flag: '🇳🇺' },
  { code: 'TK', name: 'Tokelau', flag: '🇹🇰' },
];

export const AddressRegistration: React.FC<AddressRegistrationProps> = ({ 
  isOpen, 
  onClose, 
  onRegister,
  initialAgid,
  initialAddress,
  currentCoords,
  forceAoidMode
}) => {
  const [agidInput, setAgidInput] = useState(initialAgid || '');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [isQrScanning, setIsQrScanning] = useState(false);
  const qrScannerRef = React.useRef<Html5QrcodeScanner | null>(null);
  const qrFileRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    country: 'JP',
    recipient: '',
    organization: '',
    street: '',
    city: '',
    state: '',
    postcode: '',
    suburb: '',
    district: '',
    subdistrict: '',
    block: '',
    lot: '',
    section: '',
    lane: '',
    alley: ' ',
    floor: '',
    room: '',
  });

  const [isBritishTerritoryMode, setIsBritishTerritoryMode] = useState(false);
  const [isFrenchTerritoryMode, setIsFrenchTerritoryMode] = useState(false);
  const [isNorwegianTerritoryMode, setIsNorwegianTerritoryMode] = useState(false);
  const [isSpanishTerritoryMode, setIsSpanishTerritoryMode] = useState(false);
  const [isPortugueseTerritoryMode, setIsPortugueseTerritoryMode] = useState(false);
  const [isDutchTerritoryMode, setIsDutchTerritoryMode] = useState(false);
  const [isDanishTerritoryMode, setIsDanishTerritoryMode] = useState(false);
  const [isAustralianTerritoryMode, setIsAustralianTerritoryMode] = useState(false);
  const [isNewZealandTerritoryMode, setIsNewZealandTerritoryMode] = useState(false);
  const [isUSTerritoryMode, setIsUSTerritoryMode] = useState(false);
  const [isChileTerritoryMode, setIsChileTerritoryMode] = useState(false);
  const [isAoidMode, setIsAoidMode] = useState(forceAoidMode || false);

  useEffect(() => {
    if (isOpen && forceAoidMode !== undefined) {
      setIsAoidMode(forceAoidMode);
    }
  }, [isOpen, forceAoidMode]);

  useEffect(() => {
    if (initialAddress && !formData.street) {
      setFormData(prev => ({ ...prev, street: initialAddress }));
    }
  }, [initialAddress]);

  useEffect(() => {
    const isBT = BRITISH_TERRITORIES.some(t => t.code === formData.country);
    const isFT = FRENCH_TERRITORIES.some(t => t.code === formData.country);
    const isNT = NORWEGIAN_TERRITORIES.some(t => t.code === formData.country);
    const isST = SPANISH_TERRITORIES.some(t => t.code === formData.country);
    const isPT = PORTUGUESE_TERRITORIES.some(t => t.code === formData.country);
    const isDT = DUTCH_TERRITORIES.some(t => t.code === formData.country);
    const isDKT = DANISH_TERRITORIES.some(t => t.code === formData.country);
    const isAUT = AUSTRALIAN_TERRITORIES.some(t => t.code === formData.country);
    const isNZT = NEW_ZEALAND_TERRITORIES.some(t => t.code === formData.country);
    const isUST = US_TERRITORIES.some(t => t.code === formData.country) || formData.country === 'US';
    const isCLT = CHILE_TERRITORIES.some(t => t.code === formData.country) || formData.country === 'CL';
    
    setIsBritishTerritoryMode(isBT);
    setIsFrenchTerritoryMode(isFT);
    setIsNorwegianTerritoryMode(isNT);
    setIsSpanishTerritoryMode(isST);
    setIsPortugueseTerritoryMode(isPT);
    setIsDutchTerritoryMode(isDT);
    setIsDanishTerritoryMode(isDKT);
    setIsAustralianTerritoryMode(isAUT);
    setIsNewZealandTerritoryMode(isNZT);
    setIsUSTerritoryMode(isUST);
    setIsChileTerritoryMode(isCLT);
  }, [formData.country]);

  const currentFlag = React.useMemo(() => {
    const allTerritories = [
      ...BRITISH_TERRITORIES,
      ...FRENCH_TERRITORIES,
      ...NORWEGIAN_TERRITORIES,
      ...SPANISH_TERRITORIES,
      ...PORTUGUESE_TERRITORIES,
      ...DUTCH_TERRITORIES,
      ...DANISH_TERRITORIES,
      ...AUSTRALIAN_TERRITORIES,
      ...NEW_ZEALAND_TERRITORIES,
      ...US_TERRITORIES,
      ...CHILE_TERRITORIES
    ];
    const territory = allTerritories.find(t => t.code === formData.country);
    if (territory) return territory.flag;
    
    const country = COUNTRIES.find(c => c.code === formData.country);
    if (country) return country.flag;
    
    return '🏳️';
  }, [formData.country]);

  const [agidData, setAgidData] = useState<any>(null);
  const [metadata, setMetadata] = useState<AddressMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<string>('local');
  const [availableLangs, setAvailableLangs] = useState<string[]>(['local', 'en']);
  const [localFormat, setLocalFormat] = useState<AddressFormat | null>(null);

  // Load local format
  useEffect(() => {
    let isMounted = true;
    const loadFormat = async () => {
      const format = await getAddressFormat(formData.country);
      if (isMounted) {
        setLocalFormat(format);
      }
    };
    loadFormat();
    return () => { isMounted = false; };
  }, [formData.country]);

  const [isTranslating, setIsTranslating] = useState(false);
  const [consensus, setConsensus] = useState<{ confidence: number, entropy: number } | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [isPhoneSearching, setIsPhoneSearching] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [isZipSearching, setIsZipSearching] = useState(false);
  const [polarContext, setPolarContext] = useState<PolarContext | null>(null);
  const [polarOfficialData, setPolarOfficialData] = useState<any>(null);
  const [natureContext, setNatureContext] = useState<NatureContext | null>(null);
  const [seaContext, setSeaContext] = useState<SeaContext | null>(null);
  const [heritageContext, setHeritageContext] = useState<HeritageContext | null>(null);
  const [japaneseGeoContext, setJapaneseGeoContext] = useState<JapaneseGeoContext | null>(null);
  const [elevationData, setElevationData] = useState<{ elevation: number, source: string } | null>(null);
  const [postcodeFormat, setPostcodeFormat] = useState<string>('default');
  const [localCoords, setLocalCoords] = useState<{ lat: number, lon: number } | null>(null);

  const handleQrResult = (text: string) => {
    let agid = text;
    try {
      if (text.startsWith('http')) {
        const url = new URL(text);
        const params = new URLSearchParams(url.search);
        agid = params.get('agid') || text;
      }
    } catch (e) {}

    // Basic validation to extract AGID if it's a URL
    if (agid.includes(':')) {
      agid = agid.split(':').pop() || agid;
    }

    const agidMatch = agid.trim().toUpperCase().match(/^[A-Z]{2,4}[A-Z2-9]{8,10}$/);
    if (agidMatch) {
      setAgidInput(agidMatch[0]);
      handleAgidLookup(agidMatch[0]);
      setIsQrScanning(false);
    } else {
      setError('Invalid QR code content for AGID');
    }
  };

  const startQrScanner = () => {
    setIsQrScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reg-qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      const onScanSuccess = (decodedText: string) => {
        scanner.clear().then(() => {
          handleQrResult(decodedText);
        });
      };
      scanner.render(onScanSuccess, () => {});
      qrScannerRef.current = scanner;
    }, 100);
  };

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const html5QrCode = new Html5Qrcode("reg-qr-reader-hidden");
    html5QrCode.scanFile(file, true)
      .then(decodedText => {
        handleQrResult(decodedText);
      })
      .catch(() => {
        setError('Could not find a QR code in the selected image.');
      })
      .finally(() => {
        if (qrFileRef.current) qrFileRef.current.value = '';
      });
  };

  useEffect(() => {
    if (isOpen && initialAgid) {
      setAgidInput(initialAgid);
      handleAgidLookup(initialAgid);
    } else if (isOpen && !initialAgid) {
      // Reset if opened without initial AGID
      setAgidInput('');
      setAgidData(null);
      setSuccess(false);
      setError(null);
    }
  }, [isOpen, initialAgid]);

  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear().catch(e => console.error("QR Scanner Cleanup Error:", e));
      }
    };
  }, []);

  const handleAgidLookup = async (input?: string) => {
    const targetAgid = input || agidInput;
    if (!targetAgid) return;
    setIsSearching(true);
    setError(null);
    
    try {
      const decoded = decodeAGID(targetAgid);
      if (decoded) {
        setLocalCoords({ lat: decoded.lat, lon: decoded.lon });
        const prefix = targetAgid.slice(0, 2);
        const agidResult = encodeAGID(decoded.lat, decoded.lon);
        setAgidData(agidResult);
        
        // Use activeTab instead of hardcoded 'en' for lookup
        const result = await regionalReverseGeocode(decoded.lat, decoded.lon, activeTab === 'local' ? 'en' : activeTab, prefix.toLowerCase());
        
        // Calculate consensus metrics if we have multiple candidates (mocking for now based on result quality)
        const mockProbs = new Map<string, number>();
        mockProbs.set(targetAgid, 0.85);
        mockProbs.set(targetAgid.substring(0, 11) + 'X', 0.1);
        mockProbs.set(targetAgid.substring(0, 11) + 'Y', 0.05);
        const metrics = calculateConsensusMetrics(mockProbs);
        setConsensus(metrics);

        if (result) {
          const addr = result.address || {};
          setPolarContext(result.polar_context || null);
          setPolarOfficialData(result.polar_official_data || null);
          setNatureContext(result.nature_context || null);
          setSeaContext(result.sea_context || null);
          setHeritageContext(result.heritage_context || null);
          setJapaneseGeoContext(result.japanese_geo_context || null);
          if (result.elevation !== undefined) {
            setElevationData({ 
              elevation: result.elevation, 
              source: result.official_regional_data?.elevation_source || 'Open-Elevation/OpenTopoData' 
            });
          }
          setFormData(prev => ({
            ...prev,
            country: prefix.toUpperCase(),
            street: addr.road || addr.pedestrian || addr.suburb || '',
            city: addr.city || addr.town || addr.village || '',
            state: addr.state || addr.province || '',
            postcode: addr.postcode || '',
            suburb: addr.neighbourhood || addr.suburb || '',
          }));
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
        } else {
          setError('Could not find address details for this AGID');
        }
      } else {
        setError('Invalid AGID format');
      }
    } catch (err) {
      setError('Failed to lookup AGID');
    } finally {
      setIsSearching(false);
    }
  };

  // Pre-fill if initialAgid or initialAddress changes
  useEffect(() => {
    if (isOpen) {
      if (initialAgid) {
        setAgidInput(initialAgid);
        handleAgidLookup(initialAgid);
      } else if (initialAddress) {
        setFormData(prev => ({ ...prev, street: initialAddress }));
      }
    }
  }, [isOpen, initialAgid, initialAddress]);

  // Automatic translation of fields when tab changes
  useEffect(() => {
    const translateFields = async () => {
      if (!formData.street && !formData.city && !formData.state) return;
      
      // If switching to English, we want to ensure everything (except buildings) is in English
      // If switching to another language, we translate to that language.
      
        setIsTranslating(true);
        try {
          const targetLang = activeTab === 'local' ? (metadata?.lang || 'en') : activeTab;
          
          const fieldsToTranslate = ['street', 'city', 'state', 'suburb', 'district', 'subdistrict'];
          const translatedValues: any = {};
          let changed = false;
          
          await Promise.all(fieldsToTranslate.map(async (field) => {
            const val = (formData as any)[field];
            if (val) {
              const translated = await translateAddressOpenSource(val, activeTab);
              if (translated && translated !== val) {
                translatedValues[field] = translated;
                changed = true;
              }
            }
          }));
          
          if (changed) {
            setFormData(prev => ({ ...prev, ...translatedValues }));
          }
        } catch (e) {
        console.error("Field translation error:", e);
      } finally {
        setIsTranslating(false);
      }
    };

    if (isOpen) {
      translateFields();
    }
  }, [activeTab, isOpen]);

  const t = (key: string) => {
    return UI_STRINGS[activeTab]?.[key] || UI_STRINGS['en']?.[key] || UI_STRINGS['ja']?.[key] || key;
  };

  const getFieldLabel = (key: string) => {
    const country = formData.country;
    
    switch (key) {
      case 'N': return metadata?.name_name || t('recipient');
      case 'O': return metadata?.org_name || t('organization');
      case 'A': return metadata?.addr_name || t('street');
      case 'C': 
        if (country === 'JP') return t('cityWard');
        if (['CN', 'TW', 'KR'].includes(country)) return t('city');
        if (['GB', 'IE'].includes(country)) return t('town');
        return metadata?.locality_name || t('city');
      case 'S': 
        if (country === 'JP') return t('prefecture');
        if (['CN', 'TW', 'KR', 'VN'].includes(country)) return t('province');
        if (['US', 'CA', 'MX', 'BR', 'AU'].includes(country)) return t('state');
        if (['DE', 'AT', 'CH'].includes(country)) return t('state');
        if (['FR', 'ES', 'IT'].includes(country)) return t('region');
        if (['RU', 'KZ', 'UA', 'BY'].includes(country)) return t('oblast');
        if (['UZ', 'TJ', 'TM'].includes(country)) return t('viloyat');
        if (['SA', 'AE', 'EG', 'JO', 'LB', 'IQ'].includes(country)) return t('governorate');
        return metadata?.state_name || t('state');
      case 'D': 
        if (country === 'JP') return t('suburb');
        if (['CN', 'TW', 'KR'].includes(country)) return t('district');
        if (['GB', 'IE'].includes(country)) return t('county');
        if (['FR', 'BE', 'LU'].includes(country)) return t('department');
        return metadata?.sub_name || t('suburb');
      case 'Z': return metadata?.zip_name || t('postcode');
      case 'B': return t('block');
      case 'L': return t('lot');
      case 'Sec': return t('section');
      case 'Ln': return t('lane');
      case 'Aly': return t('alley');
      case 'Fl': return t('floor');
      case 'Rm': return t('room');
      default: return '';
    }
  };

  const getOrderedFields = () => {
    const country = formData.country;
    const isBigToSmall = BIG_TO_SMALL_COUNTRIES.includes(country.toLowerCase());

    if (activeTab === 'en') {
      return ['N', 'O', 'A', 'D', 'C', 'S', 'Z'];
    }
    
    if (country === 'TW') {
      return ['Z', 'S', 'C', 'D', 'A', 'Sec', 'Ln', 'Aly', 'Fl', 'O', 'N'];
    }

    if (['HK', 'MO'].includes(country)) {
      return ['D', 'A', 'Fl', 'Rm', 'O', 'N'];
    }

    if (isBigToSmall) {
      return ['Z', 'S', 'C', 'D', 'A', 'O', 'N'];
    }

    return ['N', 'O', 'A', 'D', 'C', 'S', 'Z'];
  };

  const getPostcodeFormat = () => {
    if (localFormat?.postalCode?.format) return localFormat.postalCode.format;
    if (!metadata?.zip) return 'NNNNNNN'; // Default 7 digits
    
    // Try to convert regex to format
    // e.g. \\d{3}-\\d{4} -> NNN-NNNN
    let format = metadata.zip.replace(/\\\\d/g, 'N').replace(/\\d/g, 'N');
    format = format.replace(/\{(\d+)\}/g, (match, p1) => 'N'.repeat(parseInt(p1)));
    format = format.replace(/\[A-Z\]/g, 'A');
    format = format.replace(/\\/g, '');
    
    // Remove anchors
    format = format.replace(/^\^|\$$/g, '');
    
    return format || 'NNNNNNN';
  };

  const renderField = (fieldKey: string) => {
    if (localFormat && activeTab !== 'en') {
      // If we have a local format and not in English tab, we'll handle rendering in the main loop
      return null;
    }
    const label = getFieldLabel(fieldKey);
    switch (fieldKey) {
      case 'N':
        return (
          <div key="recipient" className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {label}
            </label>
            <input
              type="text"
              value={formData.recipient}
              onChange={(e) => setFormData({...formData, recipient: e.target.value})}
              placeholder={activeTab === 'en' ? 'Full Name' : ''}
              className="w-full bg-slate-50 px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        );
      case 'O':
        return (
          <div key="organization" className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Building2 className="w-3 h-3" />
              {label}
            </label>
            <input
              type="text"
              value={formData.organization}
              onChange={(e) => setFormData({...formData, organization: e.target.value})}
              placeholder={activeTab === 'en' ? 'Company / School' : ''}
              className="w-full bg-slate-50 px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        );
      case 'A':
        return (
          <div key="street" className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {label}
            </label>
            <textarea
              rows={3}
              value={formData.street}
              onChange={(e) => setFormData({...formData, street: e.target.value})}
              placeholder={activeTab === 'en' ? 'House number, street name, apartment, etc.' : ''}
              className="w-full bg-slate-50 px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
            />
          </div>
        );
      case 'C':
        return (
          <div key="city" className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {label}
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
              className="w-full bg-slate-50 px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        );
      case 'S':
        return (
          <div key="state" className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {label}
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({...formData, state: e.target.value})}
              className="w-full bg-slate-50 px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        );
      case 'D':
        return (
          <div key="suburb" className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {label}
            </label>
            <input
              type="text"
              value={formData.suburb}
              onChange={(e) => setFormData({...formData, suburb: e.target.value})}
              className="w-full bg-slate-50 px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        );
      case 'Sec':
      case 'Ln':
      case 'Aly':
      case 'Fl':
      case 'Rm':
      case 'B':
      case 'L':
        const fieldMap: Record<string, keyof typeof formData> = {
          'Sec': 'section',
          'Ln': 'lane',
          'Aly': 'alley',
          'Fl': 'floor',
          'Rm': 'room',
          'B': 'block',
          'L': 'lot'
        };
        const fieldName = fieldMap[fieldKey];
        return (
          <div key={fieldKey} className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {label}
            </label>
            <input
              type="text"
              value={(formData as any)[fieldName]}
              onChange={(e) => setFormData({...formData, [fieldName]: e.target.value})}
              className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        );
      case 'Z':
        if (metadata?.fmt && !metadata.fmt.includes('%Z')) return null;
        const pcFormat = getPostcodeFormat();
        return (
          <div key="postcode" className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Mail className="w-3 h-3" />
                {label}
              </label>
            </div>
            <PostcodeInput
              format={pcFormat}
              value={formData.postcode}
              onChange={(val) => setFormData({ ...formData, postcode: val })}
              className="flex-wrap"
              countryCode={formData.country}
            />
          </div>
        );
      default:
        return null;
    }
  };

  // Fetch address metadata (simulating libaddressinput logic)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const langParam = activeTab === 'local' ? '' : `/${activeTab}`;
        const response = await fetch(`/api/address-metadata?path=${formData.country}${langParam}`);
        if (response.ok) {
          const data = await response.json();
          setMetadata(data);
          
          // Update available languages based on country
          let langs: string[] = [];
          if (data.languages) {
            langs = data.languages.split('~');
          } else if (data.lang) {
            langs = [data.lang];
          } else if (COUNTRY_DEFAULT_LANGS[formData.country]) {
            langs = [COUNTRY_DEFAULT_LANGS[formData.country]];
          }

          let uniqueLangs = Array.from(new Set([...langs, 'en']));
          
          // Add languages from localFormat.international if available
          if (localFormat?.international) {
            uniqueLangs = Array.from(new Set([...uniqueLangs, ...Object.keys(localFormat.international)]));
          }

          // Add languages from COUNTRY_LANGUAGES
          const extraLangs = COUNTRY_LANGUAGES[formData.country.toLowerCase()] || [];
          uniqueLangs = Array.from(new Set([...uniqueLangs, ...extraLangs]));
          
          // India should only support English as per user request
          if (formData.country === 'IN') {
            uniqueLangs = ['en'];
          }
          
          setAvailableLangs(uniqueLangs);
          
          // If current activeTab is 'local' or not in uniqueLangs, set it to the first language
          if ((activeTab === 'local' || !uniqueLangs.includes(activeTab)) && langs.length > 0) {
            setActiveTab(langs[0]);
          } else if (uniqueLangs.length > 0 && !uniqueLangs.includes(activeTab)) {
            setActiveTab(uniqueLangs[0]);
          }
        }
      } catch (e) {
        setMetadata({
          fmt: '%N%n%O%n%A%n%C, %S %Z',
          require: 'ACSZ',
          upper: 'CS',
        });
      }
    };
    fetchMetadata();
  }, [formData.country, activeTab]);

  const handlePhoneLookup = async () => {
    if (!phoneInput) return;
    setIsPhoneSearching(true);
    setError(null);
    try {
      // Proxy search for phone/POI
      const response = await fetch(`/api/osm-search?q=${encodeURIComponent(phoneInput)}&limit=1`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const addr = data[0].address;
          setFormData(prev => ({
            ...prev,
            street: addr.road || addr.pedestrian || '',
            city: addr.city || addr.town || '',
            state: addr.state || '',
            postcode: addr.postcode || '',
            suburb: addr.suburb || addr.neighbourhood || '',
          }));
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
        } else {
          setError('No address found for this phone number');
        }
      }
    } catch (err) {
      setError('Phone lookup failed');
    } finally {
      setIsPhoneSearching(false);
    }
  };

  const handleZipLookup = async () => {
    if (!zipInput) return;
    setIsZipSearching(true);
    setError(null);
    try {
      if (formData.country === 'JP') {
        const result = await lookupJapaneseZip(zipInput);
        if (result) {
          setFormData(prev => ({
            ...prev,
            state: result.address1,
            city: result.address2,
            subdistrict: result.address3,
            postcode: result.zipcode
          }));
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
          return;
        }
      }

      // Generic lookup (e.g. Zippopotam)
      const response = await fetch(`https://api.zippopotam.us/${formData.country.toLowerCase()}/${zipInput}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.places && data.places.length > 0) {
          const place = data.places[0];
          setFormData(prev => ({
            ...prev,
            state: place.state || '',
            city: place['place name'] || '',
            postcode: data['post code']
          }));
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
        } else {
          setError('No address found for this postcode');
        }
      } else {
        setError('Postcode lookup not supported for this country or invalid code');
      }
    } catch (err) {
      setError('Postcode lookup failed');
    } finally {
      setIsZipSearching(false);
    }
  };

  const openInGoogleMaps = () => {
    if (!localCoords) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${localCoords.lat},${localCoords.lon}`;
    window.open(url, '_blank');
  };

  const openInAppleMaps = () => {
    if (!localCoords) return;
    const url = `https://maps.apple.com/?ll=${localCoords.lat},${localCoords.lon}&q=Location`;
    window.open(url, '_blank');
  };

  const openInBaiduMaps = () => {
    if (!localCoords) return;
    const [bdLng, bdLat] = wgs84tobd09(localCoords.lon, localCoords.lat);
    const url = `http://api.map.baidu.com/marker?location=${bdLat},${bdLng}&title=Location&content=Location&output=html`;
    window.open(url, '_blank');
  };

  const openInAmap = () => {
    if (!localCoords) return;
    const [gcjLng, gcjLat] = wgs84togcj02(localCoords.lon, localCoords.lat);
    const url = `https://uri.amap.com/marker?position=${gcjLng},${gcjLat}&name=Location`;
    window.open(url, '_blank');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isAoidMode) {
      if (!formData.recipient) {
        setError(t('nameRequired'));
        return;
      }
      if (!phoneInput) {
        setError(t('phoneRequired'));
        return;
      }

      // AOID Registration
      const result = {
        type: 'AOID',
        id: generateAOID(),
        name: formData.recipient,
        phone: phoneInput,
        address: formData.street,
        building: formData.organization,
        room: formData.room,
        lat: currentCoords?.lat || 0,
        lng: currentCoords?.lon || 0,
        updatedAt: Date.now()
      };
      onRegister(result);
    } else {
      onRegister(formData);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-[70] flex flex-col"
            style={{ 
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingRight: 'env(safe-area-inset-right)'
            }}
          >
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-600 w-12 h-12 md:w-14 md:h-14 rounded-none text-white shadow-lg shadow-emerald-100 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight line-clamp-1">{t('addressRegistration')}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{t('globalAddressInput')}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center hover:bg-slate-200 rounded-none transition-colors text-slate-400 active:scale-90 shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Phone & AGID Import Section */}
              <section className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                    <Search className="w-3 h-3" />
                    {t('quickLookup')}
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {/* AGID Lookup */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder={t('agidPlaceholder')}
                          value={agidInput}
                          onChange={(e) => setAgidInput(e.target.value.toUpperCase())}
                          className="w-full bg-slate-50 px-4 py-4 rounded-none border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm font-mono transition-all"
                        />
                      </div>
                      <button 
                        onClick={startQrScanner}
                        className="px-4 bg-slate-100 text-slate-600 rounded-none hover:bg-slate-200 active:scale-95 transition-all"
                        title="Scan QR"
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleAgidLookup()}
                        disabled={isSearching || !agidInput}
                        className="px-6 py-4 bg-blue-600 text-white rounded-none font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center min-w-[80px]"
                      >
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : t('agid')}
                      </button>
                    </div>

                    {/* QR Scanner Display */}
                    {isQrScanning && (
                      <div className="bg-slate-900 rounded-none overflow-hidden relative border border-slate-800 shadow-2xl">
                        <div className="p-4 bg-slate-800/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Camera className="w-4 h-4 text-red-500" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Scanner Active</span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => qrFileRef.current?.click()}
                              className="w-10 h-10 flex items-center justify-center hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white active:scale-90"
                              title="Upload Image"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                qrScannerRef.current?.clear();
                                setIsQrScanning(false);
                              }}
                              className="w-10 h-10 flex items-center justify-center hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white active:scale-90"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        <div id="reg-qr-reader" className="w-full" />
                        <input 
                          type="file" 
                          ref={qrFileRef}
                          onChange={handleQrFileUpload}
                          className="hidden" 
                          accept="image/*"
                        />
                        <div id="reg-qr-reader-hidden" className="hidden" />
                      </div>
                    )}

                    {/* Phone Lookup */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          placeholder={t('phonePlaceholder')}
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="w-full bg-slate-50 px-4 py-4 rounded-none border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm transition-all"
                        />
                      </div>
                      <button 
                        onClick={handlePhoneLookup}
                        disabled={isPhoneSearching || !phoneInput}
                        className="px-6 py-4 bg-emerald-600 text-white rounded-none font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center min-w-[80px]"
                      >
                        {isPhoneSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : t('phone')}
                      </button>
                    </div>

                    {/* Postcode Lookup */}
                    {(formData.country === 'JP' || localFormat?.postalCode?.api || ['US', 'CA', 'GB', 'FR', 'DE', 'IT', 'ES', 'BR', 'MX', 'AU', 'NZ'].includes(formData.country)) && (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder={t('postcodePlaceholder')}
                            value={zipInput}
                            onChange={(e) => setZipInput(e.target.value)}
                            className="w-full bg-slate-50 px-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 text-sm font-mono transition-all"
                          />
                        </div>
                        <button 
                          onClick={handleZipLookup}
                          disabled={isZipSearching || !zipInput}
                          className="px-6 py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-700 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center min-w-[80px]"
                        >
                          {isZipSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : t('postcodeLookup')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-3 rounded-none border border-red-100">
                    <AlertCircle className="w-4 h-4" />
                    {t('lookupError')}
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 p-3 rounded-none border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('lookupSuccess')}
                  </div>
                )}

                {/* External Map Links */}
                <div className="space-y-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Open in External Maps</p>
                  <div className="grid grid-cols-4 gap-2">
                    <button 
                      onClick={openInGoogleMaps}
                      className="flex flex-col items-center justify-center p-2 bg-white border border-slate-100 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all group"
                    >
                      <Globe className="w-4 h-4 text-red-500 mb-1" />
                      <span className="text-[8px] font-bold text-slate-500">Google</span>
                    </button>
                    <button 
                      onClick={openInAppleMaps}
                      className="flex flex-col items-center justify-center p-2 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all group"
                    >
                      <MapIcon className="w-4 h-4 text-slate-700 mb-1" />
                      <span className="text-[8px] font-bold text-slate-500">Apple</span>
                    </button>
                    <button 
                      onClick={openInBaiduMaps}
                      className="flex flex-col items-center justify-center p-2 bg-white border border-slate-100 rounded-none hover:bg-blue-50 hover:border-blue-200 transition-all group"
                    >
                      <Navigation className="w-4 h-4 text-blue-600 mb-1" />
                      <span className="text-[8px] font-bold text-slate-500">Baidu</span>
                    </button>
                    <button 
                      onClick={openInAmap}
                      className="flex flex-col items-center justify-center p-2 bg-white border border-slate-100 rounded-none hover:bg-blue-50 hover:border-blue-200 transition-all group"
                    >
                      <Navigation className="w-4 h-4 text-blue-400 mb-1" />
                      <span className="text-[8px] font-bold text-slate-500">Amap</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Japanese Geo Details Section */}
              {japaneseGeoContext && formData.country === 'JP' && (
                <section className="bg-red-50/50 p-4 rounded-none border border-red-100 space-y-3">
                  <div className="flex items-center gap-2 text-red-700 font-black text-[10px] uppercase tracking-widest">
                    <MapIcon className="w-3 h-3" />
                    {t('jpAdminDetails')}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2 rounded-none border border-red-50 shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('prefecture')}</p>
                      <p className="text-xs font-bold text-slate-700">{japaneseGeoContext.prefecture}</p>
                    </div>
                    <div className="bg-white p-2 rounded-none border border-red-50 shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('cityWard')}</p>
                      <p className="text-xs font-bold text-slate-700">{japaneseGeoContext.city || japaneseGeoContext.ward || '-'}</p>
                    </div>
                    {japaneseGeoContext.town && (
                      <div className="bg-white p-2 rounded-none border border-red-50 shadow-sm">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('townVillage')}</p>
                        <p className="text-xs font-bold text-slate-700">{japaneseGeoContext.town}</p>
                      </div>
                    )}
                    {japaneseGeoContext.chome && (
                      <div className="bg-white p-2 rounded-none border border-red-50 shadow-sm">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('chome')}</p>
                        <p className="text-xs font-bold text-slate-700">{japaneseGeoContext.chome}</p>
                      </div>
                    )}
                  </div>
                  {japaneseGeoContext.historical_name && (
                    <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-none border border-amber-100">
                      <History className="w-3 h-3 text-amber-600" />
                      <span className="text-[9px] font-bold text-amber-700 uppercase tracking-widest">{t('historicalName')}:</span>
                      <span className="text-[10px] font-black text-amber-800">{japaneseGeoContext.historical_name}</span>
                    </div>
                  )}
                </section>
              )}

              {/* Deep Sea Details Section */}
              {seaContext && (
                <section className="bg-indigo-50/50 p-4 rounded-none border border-indigo-100 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-700 font-black text-[10px] uppercase tracking-widest">
                    <Fish className="w-3 h-3" />
                    AGID Maritime Details
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-3 bg-white p-3 rounded-none border border-indigo-50 shadow-sm">
                      <div className="bg-indigo-100 p-2 rounded-none text-indigo-600">
                        <Waves className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maritime Region</p>
                        <p className="text-sm font-bold text-slate-700">{seaContext.sea_name}</p>
                      </div>
                    </div>
                    {seaContext.bathymetry !== undefined && (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-none border border-indigo-50 shadow-sm">
                        <div className="bg-blue-100 p-2 rounded-none text-blue-600">
                          <Navigation className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bathymetry (Depth)</p>
                          <p className="text-sm font-bold text-slate-700">{Math.abs(seaContext.bathymetry)}m</p>
                        </div>
                      </div>
                    )}
                    {seaContext.marine_protected_area && (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-none border border-indigo-50 shadow-sm">
                        <div className="bg-emerald-100 p-2 rounded-none text-emerald-600">
                          <ShieldIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marine Protected Area</p>
                          <p className="text-xs font-bold text-emerald-700">{seaContext.marine_protected_area}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {seaContext.features.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Marine Features</p>
                      <div className="flex flex-wrap gap-1.5">
                        {seaContext.features.slice(0, 8).map((f, i) => (
                          <span key={i} className="bg-white px-2 py-1 rounded-none text-[9px] font-bold text-indigo-600 border border-indigo-50 shadow-sm">
                            {f.name} ({f.type})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* World Heritage & Historic Sites Section */}
              {heritageContext && (heritageContext.unescoSites.length > 0 || heritageContext.historicSites.length > 0) && (
                <section className="bg-amber-50/50 p-4 rounded-none border border-amber-100 space-y-3">
                  <div className="flex items-center gap-2 text-amber-700 font-black text-[10px] uppercase tracking-widest">
                    <Landmark className="w-3 h-3" />
                    World Heritage & History
                  </div>
                  
                  {heritageContext.unescoSites.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">UNESCO World Heritage</p>
                      <div className="grid grid-cols-1 gap-2">
                        {heritageContext.unescoSites.map((site, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-none border border-amber-100 shadow-sm">
                            <div className="bg-amber-100 p-2 rounded-none text-amber-600">
                              <Globe className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-700">{site.name}</p>
                              <p className="text-[10px] text-amber-600 font-medium">{site.type}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {heritageContext.historicSites.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Significant Historic Sites</p>
                      <div className="flex flex-wrap gap-1.5">
                        {heritageContext.historicSites.slice(0, 6).map((site, i) => (
                          <span key={i} className="bg-white px-2 py-1 rounded-none text-[9px] font-bold text-slate-600 border border-slate-100 shadow-sm flex items-center gap-1.5">
                            <History className="w-2.5 h-2.5 text-slate-400" />
                            {site.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              <div className="h-px bg-slate-100" />

              {/* Polar Details Section */}
              {polarContext && (
                <section className="bg-blue-50/50 p-4 rounded-none border border-blue-100 space-y-3">
                  <div className="flex items-center gap-2 text-blue-700 font-black text-[10px] uppercase tracking-widest">
                    <Snowflake className="w-3 h-3" />
                    Polar Region Details
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-3 bg-white p-3 rounded-none border border-blue-50 shadow-sm">
                      <div className="bg-blue-100 p-2 rounded-none text-blue-600">
                        <Anchor className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maritime Area</p>
                        <p className="text-sm font-bold text-slate-700">{polarContext.region}</p>
                      </div>
                    </div>
                    {polarContext.bathymetry && (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-none border border-blue-50 shadow-sm">
                        <div className="bg-cyan-100 p-2 rounded-none text-cyan-600">
                          <Waves className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bathymetry</p>
                          <p className="text-xs font-medium text-slate-600">{polarContext.bathymetry}</p>
                        </div>
                      </div>
                    )}
                    {polarOfficialData?.address?.research_station && (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-none border border-blue-50 shadow-sm">
                        <div className="bg-emerald-100 p-2 rounded-none text-emerald-600">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Research Station</p>
                          <p className="text-sm font-bold text-slate-700">{polarOfficialData.address.research_station}</p>
                          {polarOfficialData.address.operator && (
                            <p className="text-[10px] text-slate-500">Op: {polarOfficialData.address.operator}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {polarContext.features.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nearby Features</p>
                      <div className="flex flex-wrap gap-1.5">
                        {polarContext.features.slice(0, 5).map((f, i) => (
                          <span key={i} className="bg-white px-2 py-1 rounded-none text-[9px] font-bold text-blue-600 border border-blue-50 shadow-sm">
                            {f.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Nature & Environment Section */}
              {natureContext && (
                <section className="bg-emerald-50/50 p-4 rounded-none border border-emerald-100 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 font-black text-[10px] uppercase tracking-widest">
                    <Trees className="w-3 h-3" />
                    Nature & Environment
                  </div>
                  
                  {elevationData && (
                    <div className="bg-white p-3 rounded-none border border-emerald-50 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-none text-emerald-600">
                          <Navigation className="w-4 h-4 rotate-45" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Elevation</p>
                          <p className="text-sm font-black text-slate-700">{elevationData.elevation}m</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Source</p>
                        <p className="text-[9px] font-medium text-slate-400">{elevationData.source}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {natureContext.mountains.length > 0 && (
                      <div className="bg-white p-2.5 rounded-none border border-emerald-50 shadow-sm flex items-center gap-2">
                        <div className="bg-amber-100 p-1.5 rounded-none text-amber-600">
                          <Mountain className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">Mountains</p>
                          <p className="text-[10px] font-bold text-slate-700 truncate">{natureContext.mountains[0].name}</p>
                        </div>
                      </div>
                    )}
                    {natureContext.beaches.length > 0 && (
                      <div className="bg-white p-2.5 rounded-none border border-emerald-50 shadow-sm flex items-center gap-2">
                        <div className="bg-yellow-100 p-1.5 rounded-none text-yellow-600">
                          <Palmtree className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">Beaches</p>
                          <p className="text-[10px] font-bold text-slate-700 truncate">{natureContext.beaches[0].name}</p>
                        </div>
                      </div>
                    )}
                    {natureContext.ports.length > 0 && (
                      <div className="bg-white p-2.5 rounded-none border border-emerald-50 shadow-sm flex items-center gap-2">
                        <div className="bg-blue-100 p-1.5 rounded-none text-blue-600">
                          <Ship className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">Ports</p>
                          <p className="text-[10px] font-bold text-slate-700 truncate">{natureContext.ports[0].name}</p>
                        </div>
                      </div>
                    )}
                    {natureContext.deserts.length > 0 && (
                      <div className="bg-white p-2.5 rounded-none border border-emerald-50 shadow-sm flex items-center gap-2">
                        <div className="bg-orange-100 p-1.5 rounded-none text-orange-600">
                          <Sun className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">Deserts</p>
                          <p className="text-[10px] font-bold text-slate-700 truncate">{natureContext.deserts[0].name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {natureContext.landCover && (
                    <div className="flex items-center justify-between bg-emerald-600/5 px-3 py-2 rounded-lg border border-emerald-100">
                      <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Land Cover (EO Data)</span>
                      <span className="text-[10px] font-black text-emerald-800">{natureContext.landCover}</span>
                    </div>
                  )}
                </section>
              )}

              {/* Language Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-none overflow-x-auto custom-scrollbar no-scrollbar">
                {availableLangs.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveTab(lang)}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-none text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap",
                      activeTab === lang ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {lang === 'en' ? (
                      <span className="font-mono text-[8px] border border-current px-1 rounded-none">EN</span>
                    ) : (
                      <Globe className="w-3 h-3" />
                    )}
                    {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Manual Entry Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  {/* Country Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Globe className="w-3 h-3" />
                      {t('countryRegion')}
                    </label>
                    <div className="flex gap-3">
                      <div className="w-16 h-12 bg-slate-50 rounded-none border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm text-3xl">
                        {currentFlag}
                      </div>
                      <select 
                        value={
                          isBritishTerritoryMode ? 'GB_GROUP' : 
                          isFrenchTerritoryMode ? 'FR_GROUP' : 
                          isNorwegianTerritoryMode ? 'NO_GROUP' :
                          isSpanishTerritoryMode ? 'ES_GROUP' :
                          isPortugueseTerritoryMode ? 'PT_GROUP' :
                          isDutchTerritoryMode ? 'NL_GROUP' :
                          isDanishTerritoryMode ? 'DK_GROUP' :
                          isAustralianTerritoryMode ? 'AU_GROUP' :
                          isNewZealandTerritoryMode ? 'NZ_GROUP' :
                          isUSTerritoryMode ? 'US_GROUP' :
                          isChileTerritoryMode ? 'CL_GROUP' :
                          formData.country
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'GB_GROUP') {
                            setFormData({...formData, country: 'GB'});
                          } else if (val === 'FR_GROUP') {
                            setFormData({...formData, country: 'FR'});
                          } else if (val === 'NO_GROUP') {
                            setFormData({...formData, country: 'NO'});
                          } else if (val === 'ES_GROUP') {
                            setFormData({...formData, country: 'ES'});
                          } else if (val === 'PT_GROUP') {
                            setFormData({...formData, country: 'PT'});
                          } else if (val === 'NL_GROUP') {
                            setFormData({...formData, country: 'NL'});
                          } else if (val === 'DK_GROUP') {
                            setFormData({...formData, country: 'DK'});
                          } else if (val === 'AU_GROUP') {
                            setFormData({...formData, country: 'AU'});
                          } else if (val === 'NZ_GROUP') {
                            setFormData({...formData, country: 'NZ'});
                          } else if (val === 'US_GROUP') {
                            setFormData({...formData, country: 'US'});
                          } else if (val === 'CL_GROUP') {
                            setFormData({...formData, country: 'CL'});
                          } else {
                            setFormData({...formData, country: val});
                          }
                        }}
                        className="flex-1 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                      >
                        {Array.from(new Set(COUNTRIES.map(c => c.region))).map(region => (
                          <optgroup key={region} label={region}>
                            {COUNTRIES.filter(c => c.region === region).map(country => (
                              <option key={country.code} value={country.code}>
                                {country.flag} {country.name} {country.nativeName ? `(${country.nativeName})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <optgroup label="Groups">
                          <option value="GB_GROUP">United Kingdom & Territories</option>
                          <option value="FR_GROUP">France & Territories</option>
                          <option value="NO_GROUP">Norway & Territories</option>
                          <option value="ES_GROUP">Spain & Territories</option>
                          <option value="PT_GROUP">Portugal & Territories</option>
                          <option value="NL_GROUP">Netherlands & Territories</option>
                          <option value="DK_GROUP">Denmark & Territories</option>
                          <option value="AU_GROUP">Australia & Territories</option>
                          <option value="NZ_GROUP">New Zealand & Territories</option>
                          <option value="US_GROUP">USA & Territories</option>
                          <option value="CL_GROUP">Chile & Territories</option>
                        </optgroup>
                      </select>
                    </div>

                    {isBritishTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-emerald-50 rounded-none border border-emerald-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            British Overseas Territories & Crown Dependencies
                          </label>
                          <span className="text-[8px] font-bold text-emerald-400 bg-white px-2 py-0.5 rounded-none border border-emerald-100">
                            {BRITISH_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           {BRITISH_TERRITORIES.map(t => (
                            <button
                              key={t.code}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-emerald-600 text-white border-emerald-700 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-emerald-100 border-emerald-100 hover:border-emerald-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isFrenchTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-blue-50 rounded-none border border-blue-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            France Overseas Departments & Collectivities
                          </label>
                          <span className="text-[8px] font-bold text-blue-400 bg-white px-2 py-0.5 rounded-none border border-blue-100">
                            {FRENCH_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           {FRENCH_TERRITORIES.map(t => (
                            <button
                              key={t.code}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-blue-500 text-white border-blue-600 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-blue-100 border-blue-100 hover:border-blue-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isNorwegianTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-slate-50 rounded-none border border-slate-200"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            Norwegian Territories
                          </label>
                          <span className="text-[8px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-none border border-slate-100">
                            {NORWEGIAN_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           {NORWEGIAN_TERRITORIES.map(t => (
                            <button
                              key={t.code}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-slate-600 text-white border-slate-700 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-slate-100 border-slate-100 hover:border-slate-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isSpanishTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-yellow-50 rounded-none border border-yellow-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">
                            Spanish Territories
                          </label>
                          <span className="text-[8px] font-bold text-yellow-400 bg-white px-2 py-0.5 rounded-none border border-yellow-100">
                            {SPANISH_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           {SPANISH_TERRITORIES.map(t => (
                            <button
                              key={t.code}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-yellow-500 text-white border-yellow-600 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-yellow-100 border-yellow-100 hover:border-yellow-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isPortugueseTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-red-50 rounded-none border border-red-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                            Portuguese Territories
                          </label>
                          <span className="text-[8px] font-bold text-red-400 bg-white px-2 py-0.5 rounded-none border border-red-100">
                            {PORTUGUESE_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           {PORTUGUESE_TERRITORIES.map(t => (
                            <button
                              key={t.code}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-red-500 text-white border-red-600 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-red-100 border-red-100 hover:border-red-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isDutchTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-orange-50 rounded-none border border-orange-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest">
                            Dutch Territories
                          </label>
                          <span className="text-[8px] font-bold text-orange-400 bg-white px-2 py-0.5 rounded-none border border-orange-100">
                            {DUTCH_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           {DUTCH_TERRITORIES.map(t => (
                            <button
                              key={t.code}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-orange-500 text-white border-orange-600 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-orange-100 border-orange-100 hover:border-orange-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isDanishTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-red-50 rounded-none border border-red-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                            Danish Territories
                          </label>
                          <span className="text-[8px] font-bold text-red-400 bg-white px-2 py-0.5 rounded-none border border-red-100">
                            {DANISH_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {DANISH_TERRITORIES.map(t => (
                            <button
                              key={t.code}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-red-500 text-white border-red-600 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-red-100 border-red-100 hover:border-red-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isAustralianTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-blue-50 rounded-none border border-blue-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            Australian Territories
                          </label>
                          <span className="text-[8px] font-bold text-blue-400 bg-white px-2 py-0.5 rounded-none border border-blue-100">
                            {AUSTRALIAN_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {AUSTRALIAN_TERRITORIES.map(t => (
                            <button
                              key={t.code}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-blue-500 text-white border-blue-600 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-blue-100 border-blue-100 hover:border-blue-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isNewZealandTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-slate-50 rounded-none border border-slate-200"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            New Zealand Territories
                          </label>
                          <span className="text-[8px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-none border border-slate-200">
                            {NEW_ZEALAND_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {NEW_ZEALAND_TERRITORIES.map(t => (
                            <button
                              key={t.code}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-slate-800 text-white border-slate-900 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isUSTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-blue-50 rounded-none border border-blue-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            USA Overseas Territories & Insular Areas
                          </label>
                          <span className="text-[8px] font-bold text-blue-400 bg-white px-2 py-0.5 rounded-none border border-blue-100">
                            {US_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {US_TERRITORIES.map(t => (
                            <button
                              key={t.name}
                              type="button"
                              onClick={() => setFormData({...formData, country: t.code})}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                formData.country === t.code 
                                  ? "bg-blue-600 text-white border-blue-700 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-blue-100 border-blue-100 hover:border-blue-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {isChileTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-red-50 rounded-none border border-red-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                            Chile Overseas Territories & Insular Areas
                          </label>
                          <span className="text-[8px] font-bold text-red-400 bg-white px-2 py-0.5 rounded-none border border-red-100">
                            {CHILE_TERRITORIES.length} Regions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {CHILE_TERRITORIES.map(t => (
                            <button
                              key={t.name}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, country: 'CL'});
                                if (t.code !== 'CL') {
                                  setFormData(prev => ({ ...prev, state: t.name }));
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none text-[10px] font-bold transition-all border",
                                (formData.country === 'CL' && (t.code === 'CL' ? !formData.state : formData.state === t.name))
                                  ? "bg-red-600 text-white border-red-700 shadow-sm scale-[1.02]" 
                                  : "bg-white text-slate-600 hover:bg-red-100 border-red-100 hover:border-red-200"
                              )}
                            >
                              <span className="text-sm">{t.flag}</span>
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Dynamic Ordered Fields */}
                  <div className="space-y-6">
                    {localFormat ? (
                      (() => {
                        // Priority: 
                        // 1. If 'en' tab and localFormat.english exists
                        // 2. If activeTab matches localFormat.international[lang]
                        // 3. Fallback to native
                        let currentFormat = localFormat.native;
                        if (activeTab === 'en' && localFormat.english) {
                          currentFormat = localFormat.english;
                        } else if (localFormat.international && localFormat.international[activeTab]) {
                          currentFormat = localFormat.international[activeTab];
                        }
                        
                        const fields = currentFormat?.fields || localFormat.fields || [];
                        
                        return fields.map(field => (
                          <div key={field.key} className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              {field.key === 'postcode' && <Mail className="w-3 h-3" />}
                              {field.key === 'organization' && <Building2 className="w-3 h-3" />}
                              {field.label}
                            </label>
                            {field.key === 'street' || field.key === 'organization' ? (
                              <textarea
                                rows={field.key === 'organization' ? 2 : 3}
                                value={(formData as any)[field.key] || ''}
                                onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                                placeholder={field.placeholder}
                                className="w-full bg-slate-50 px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                              />
                            ) : field.key === 'postcode' ? (
                              <PostcodeInput
                                format={getPostcodeFormat()}
                                value={formData.postcode}
                                onChange={(val) => setFormData({ ...formData, postcode: val })}
                                className="flex-wrap"
                                countryCode={formData.country}
                              />
                            ) : (
                              <input
                                type={field.type || 'text'}
                                value={(formData as any)[field.key] || ''}
                                onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                                placeholder={field.placeholder}
                                className="w-full bg-slate-50 px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                              />
                            )}
                          </div>
                        ));
                      })()
                    ) : (
                      getOrderedFields().map(fieldKey => renderField(fieldKey))
                    )}
                  </div>

                  {/* AGID Metadata Section */}
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldIcon className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        AGID Algorithm Metadata
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-none border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Mountain Class</div>
                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Mountain className="w-3 h-3 text-slate-400" />
                          {elevationData?.elevation !== undefined ? `Class ${calculateMountainClass(elevationData.elevation)}` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-none border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Confidence</div>
                        <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {consensus ? `${(consensus.confidence * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-none border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Entropy</div>
                        <div className="text-xs font-mono text-slate-600">
                          {consensus ? consensus.entropy.toFixed(3) : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-none border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Domain</div>
                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          {agidData?.domain || 'Standard'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AOID Mode Toggle */}
                <div className="bg-emerald-50 p-4 rounded-none border border-emerald-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 font-black text-[10px] uppercase tracking-widest">
                      <ShieldIcon className="w-3 h-3" />
                      {t('registerAoid')}
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsAoidMode(!isAoidMode)}
                      className={cn(
                        "relative w-14 h-7 rounded-full transition-colors",
                        isAoidMode ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    >
                      <motion.div 
                        animate={{ x: isAoidMode ? 29 : 3 }}
                        className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-600/80 font-bold leading-relaxed">
                    {t('aoidTip')}
                  </p>
                </div>

                <div className="pt-6">
                  <button 
                    type="submit"
                    className={cn(
                      "w-full py-5 rounded-none font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95",
                      isAoidMode 
                        ? "bg-slate-900 text-white shadow-slate-200" 
                        : "bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700"
                    )}
                  >
                    {isAoidMode ? <ShieldIcon className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    {isAoidMode ? t('registerAsAoid') : t('registerAddress')}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
