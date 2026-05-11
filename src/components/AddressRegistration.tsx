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
];

const CHILE_TERRITORIES = [
  { code: 'CL', name: 'Chile (Mainland)', flag: '🇨🇱' },
  { code: 'CL_EA', name: 'Easter Island', flag: '🗿' },
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
  
  const [formData, setFormData] = useState({
    country: 'JP',
    recipient: '',
    organization: '',
    street: '',
    city: '',
    state: '',
    postcode: '',
    suburb: '',
    phone: '',
  });

  const [isAoidMode, setIsAoidMode] = useState(forceAoidMode || false);
  const [activeTab, setActiveTab] = useState<string>('local');
  const [localFormat, setLocalFormat] = useState<AddressFormat | null>(null);
  const [consensus, setConsensus] = useState<{ confidence: number, entropy: number } | null>(null);
  const [elevationData, setElevationData] = useState<{ elevation: number, source: string } | null>(null);
  const [agidData, setAgidData] = useState<any>(null);

  useEffect(() => {
    if (initialAgid) {
      const decoded = decodeAGID(initialAgid);
      setAgidData(decoded);
    }
  }, [initialAgid]);

  useEffect(() => {
    const loadFormat = async () => {
      const format = await getAddressFormat(formData.country);
      setLocalFormat(format);
    };
    loadFormat();
  }, [formData.country]);

  const t = (key: string) => {
    const lang = navigator.language.split('-')[0];
    return UI_STRINGS[lang]?.[key] || UI_STRINGS['en'][key] || key;
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAoidMode && !formData.phone) {
      setError(t('phoneRequired'));
      return;
    }
    onRegister({ ...formData, isAoid: isAoidMode });
    setSuccess(true);
    setTimeout(onClose, 1500);
  };

  const currentFlag = React.useMemo(() => {
    const country = COUNTRIES.find(c => c.code === formData.country);
    return country ? country.flag : '🌐';
  }, [formData.country]);

  const isBritishTerritoryMode = BRITISH_TERRITORIES.some(t => t.code === formData.country);
  const isFrenchTerritoryMode = FRENCH_TERRITORIES.some(t => t.code === formData.country);
  const isNorwegianTerritoryMode = NORWEGIAN_TERRITORIES.some(t => t.code === formData.country);
  const isSpanishTerritoryMode = SPANISH_TERRITORIES.some(t => t.code === formData.country);
  const isPortugueseTerritoryMode = PORTUGUESE_TERRITORIES.some(t => t.code === formData.country);
  const isDutchTerritoryMode = DUTCH_TERRITORIES.some(t => t.code === formData.country);
  const isDanishTerritoryMode = DANISH_TERRITORIES.some(t => t.code === formData.country);
  const isAustralianTerritoryMode = AUSTRALIAN_TERRITORIES.some(t => t.code === formData.country);
  const isNewZealandTerritoryMode = NEW_ZEALAND_TERRITORIES.some(t => t.code === formData.country);
  const isUSTerritoryMode = US_TERRITORIES.some(t => t.code === formData.country);
  const isChileTerritoryMode = CHILE_TERRITORIES.some(t => t.code === formData.country);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl z-[101] border border-slate-200"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 rounded-2xl">
                    <MapPin className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                    {t('addressRegistration')}
                  </h2>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleRegister} className="space-y-8">
                {/* AOID Mode Toggle */}
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 font-black text-[10px] uppercase tracking-widest">
                      <ShieldIcon className="w-3 h-3" />
                      {t('registerAoid')}
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsAoidMode(!isAoidMode)}
                      className={cn(
                        "relative w-14 h-7 rounded-3xl transition-colors",
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

                <div className="space-y-6">
                  {/* Language Tabs */}
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                    {['local', 'en', 'romaji'].map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveTab(lang)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black transition-all",
                          activeTab === lang 
                            ? "bg-white text-slate-800 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Country Selector */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {t('countryRegion')}
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                          <span className="text-xl rounded-xl overflow-hidden leading-none">{currentFlag}</span>
                        </div>
                        <select
                          value={formData.country}
                          onChange={(e) => setFormData({...formData, country: e.target.value})}
                          className="w-full bg-slate-50 pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold appearance-none hover:bg-white transition-all cursor-pointer"
                        >
                          {COUNTRIES.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Globe className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>

                    {/* Territory Selectors */}
                    {isBritishTerritoryMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            British Overseas Territories & Crown Dependencies
                          </label>
                          <span className="text-[8px] font-bold text-emerald-400 bg-white px-2 py-0.5 rounded-lg border border-emerald-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-blue-50 rounded-2xl border border-blue-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            France Overseas Departments & Collectivities
                          </label>
                          <span className="text-[8px] font-bold text-blue-400 bg-white px-2 py-0.5 rounded-lg border border-blue-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            Norwegian Territories
                          </label>
                          <span className="text-[8px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-yellow-50 rounded-2xl border border-yellow-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">
                            Spanish Territories
                          </label>
                          <span className="text-[8px] font-bold text-yellow-400 bg-white px-2 py-0.5 rounded-lg border border-yellow-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-red-50 rounded-2xl border border-red-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                            Portuguese Territories
                          </label>
                          <span className="text-[8px] font-bold text-red-400 bg-white px-2 py-0.5 rounded-lg border border-red-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-orange-50 rounded-2xl border border-orange-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest">
                            Dutch Territories
                          </label>
                          <span className="text-[8px] font-bold text-orange-400 bg-white px-2 py-0.5 rounded-lg border border-orange-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-red-50 rounded-2xl border border-red-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                            Danish Territories
                          </label>
                          <span className="text-[8px] font-bold text-red-400 bg-white px-2 py-0.5 rounded-lg border border-red-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-blue-50 rounded-2xl border border-blue-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            Australian Territories
                          </label>
                          <span className="text-[8px] font-bold text-blue-400 bg-white px-2 py-0.5 rounded-lg border border-blue-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            New Zealand Territories
                          </label>
                          <span className="text-[8px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-blue-50 rounded-2xl border border-blue-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            USA Overseas Territories & Insular Areas
                          </label>
                          <span className="text-[8px] font-bold text-blue-400 bg-white px-2 py-0.5 rounded-lg border border-blue-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                        className="space-y-3 p-4 bg-red-50 rounded-2xl border border-red-100"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                            Chile Overseas Territories & Insular Areas
                          </label>
                          <span className="text-[8px] font-bold text-red-400 bg-white px-2 py-0.5 rounded-lg border border-red-100">
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
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
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
                                className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                              />
                            ) : field.key === 'postcode' ? (
                              <PostcodeInput
                                format="7-digit"
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
                                className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                              />
                            )}
                          </div>
                        ));
                      })()
                    ) : (
                      <div className="p-8 text-center text-slate-400">Loading format...</div>
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
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Mountain Class</div>
                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Mountain className="w-3 h-3 text-slate-400" />
                          {elevationData?.elevation !== undefined ? `Class ${calculateMountainClass(elevationData.elevation)}` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Confidence</div>
                        <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {consensus ? `${(consensus.confidence * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Entropy</div>
                        <div className="text-xs font-mono text-slate-600">
                          {consensus ? consensus.entropy.toFixed(3) : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Domain</div>
                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          {agidData?.domain || 'Standard'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    type="submit"
                    className={cn(
                      "w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95",
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
