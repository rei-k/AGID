
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Settings, 
  Home, 
  Smartphone, 
  ShieldCheck, 
  Download, 
  FileDown, 
  FileText, 
  Info, 
  ChevronRight, 
  Bookmark, 
  History, 
  MapPin, 
  Share2, 
  Globe, 
  Ruler, 
  Navigation, 
  Layers, 
  RotateCcw, 
  Database, 
  Trash2, 
  BookOpen, 
  ArrowRight, 
  Scale, 
  Grid3X3, 
  Activity, 
  Sparkles, 
  BarChart3, 
  Box, 
  Search, 
  LocateFixed, 
  Check,
  Search as SearchIcon,
  Map as MapIcon,
  Compass
} from 'lucide-react';
import { cn } from '../lib/utils';
import { LANGUAGES } from '../lib/addressUtils';
import { TRANSLATIONS } from '../constants/translations';
import { MAJOR_CATEGORIES, MAP_STYLES } from '../constants/appConstants';
import { ExportService, ExportData } from '../services/ExportService';
import { saveAs } from 'file-saver';
import maplibregl from 'maplibre-gl';
import { LAND_REGIONS, SEA_REGIONS, COUNTRY_REGIONS } from '../lib/regions';

interface SettingsPanelProps {
  show: boolean;
  onClose: () => void;
  settingsTab: string;
  setSettingsTab: (t: string) => void;
  homeAgid: string;
  setHomeAgid: (id: string) => void;
  appLanguage: string;
  setAppLanguage: (l: string) => void;
  addressLanguage: string;
  setAddressLanguage: (l: string) => void;
  themeMode: 'light' | 'dark' | 'system';
  setThemeMode: (m: 'light' | 'dark' | 'system') => void;
  distanceUnit: 'automatic' | 'kilometers' | 'miles' | 'nautical';
  setDistanceUnit: (u: 'automatic' | 'kilometers' | 'miles' | 'nautical') => void;
  defaultNavApp: string;
  setDefaultNavApp: (a: string) => void;
  mapStyle: string;
  changeStyle: (s: string) => void;
  is3DEnabled: boolean;
  setIs3DEnabled: (v: boolean) => void;
  mapPitch: number;
  setMapPitch: (p: number) => void;
  gridOpacityLevel: number;
  setGridOpacityLevel: (l: number) => void;
  savedAgids: any[];
  setSavedAgids: (a: any[]) => void;
  searchHistory: string[];
  setSearchHistory: (h: string[]) => void;
  clearHistory: () => void;
  clickedAgid: any;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showAlert: (title: string, message: string) => void;
  setActiveLegalDoc: (d: 'privacy' | 'terms' | null) => void;
  isQualityLoading: boolean;
  fetchQualityReport: () => void;
  registryStats: any;
  setShowResources: (v: boolean) => void;
  setShowLicenses: (v: boolean) => void;
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
  jumpToAgid: (id: string) => void;
  t: (key: string) => string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  show,
  onClose,
  settingsTab,
  setSettingsTab,
  homeAgid,
  setHomeAgid,
  appLanguage,
  setAppLanguage,
  addressLanguage,
  setAddressLanguage,
  themeMode,
  setThemeMode,
  distanceUnit,
  setDistanceUnit,
  defaultNavApp,
  setDefaultNavApp,
  mapStyle,
  changeStyle,
  is3DEnabled,
  setIs3DEnabled,
  mapPitch,
  setMapPitch,
  gridOpacityLevel,
  setGridOpacityLevel,
  savedAgids,
  setSavedAgids,
  searchHistory,
  setSearchHistory,
  clearHistory,
  clickedAgid,
  showConfirm,
  showAlert,
  setActiveLegalDoc,
  isQualityLoading,
  fetchQualityReport,
  registryStats,
  setShowResources,
  setShowLicenses,
  mapRef,
  jumpToAgid,
  t
}) => {
  // Local state for searching codes
  const [codeSearch, setCodeSearch] = React.useState('');
  const [codeFilter, setCodeFilter] = React.useState<'ALL' | 'LAND' | 'SEA'>('ALL');

  const filteredCodes = React.useMemo(() => {
    let all = [...COUNTRY_REGIONS, ...SEA_REGIONS];
    if (codeFilter === 'LAND') all = COUNTRY_REGIONS;
    if (codeFilter === 'SEA') all = SEA_REGIONS;

    const query = codeSearch.toLowerCase();
    
    // Map sea long codes to short codes for searching
    const seaShortMap: { [key: string]: string } = {
      'NPAC': 'P1', 'NEPC': 'P0', 'SPAC': 'P3', 'SEPC': 'P2',
      'NATL': 'A1', 'SATL': 'A2', 'NIND': 'I1', 'SIND': 'I2',
      'SOUT': 'S0', 'ARCT': 'R0'
    };

    if (!query) return all.slice(0, 50);

    return all.filter(r => {
      const id = (r.id || r.code || '').toLowerCase();
      const name = r.name.toLowerCase();
      const short = isSeaRegion(r) ? (seaShortMap[r.id || ''] || '').toLowerCase() : id;
      
      return id.includes(query) || name.includes(query) || short === query;
    }).sort((a, b) => {
      // Prioritize exact matches on code
      const aId = (a.id || a.code || '').toLowerCase();
      const bId = (b.id || b.code || '').toLowerCase();
      if (aId === query) return -1;
      if (bId === query) return 1;
      return a.name.localeCompare(b.name);
    }).slice(0, 100);
  }, [codeSearch, codeFilter]);

  function isSeaRegion(r: any): boolean {
    return !!r.isSea || !COUNTRY_REGIONS.some(c => c.id === r.id || c.code === (r.id || r.code));
  }

  const [selectedBaseLang, setSelectedBaseLang] = React.useState<string | null>(null);

  // Group languages by base code (e.g. 'en', 'es', 'ar')
  const groupedLanguages = React.useMemo(() => {
    const groups: Record<string, typeof LANGUAGES> = {};
    const indianLangs = ['hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur'];
    const saLangs = ['af', 'zu', 'xh'];
    const deLangs = ['de', 'de-AT', 'de-CH', 'nds', 'hsb', 'dsb'];
    const esRegionalLangs = ['ca', 'gl', 'eu'];
    const itRegionalLangs = ['sc', 'fur', 'co'];
    const euRegionalLangs = ['cy', 'gd', 'lb', 'rm', 'br', 'oc', 'wa', 'fy', 'ga', 'is', 'vls', 'li'];
    const hispanosphereEs = ['es', 'es-MX', 'es-AR', 'es-CO', 'es-PE', 'es-VE', 'es-CL', 'es-EC', 'es-BO', 'es-PY', 'es-UY', 'es-PA', 'es-CR', 'es-NI', 'es-HN', 'es-SV', 'es-GT', 'es-DO', 'es-PR', 'es-CU', 'es-GQ'];
    const lusospherePt = ['pt', 'pt-PT', 'pt-BR', 'pt-AO', 'pt-MZ', 'pt-CV', 'pt-GW', 'pt-ST'];
    const arabicGlobal = [
      'ar', 'ar-SA', 'ar-EG', 'ar-AE', 'ar-KW', 'ar-QA', 'ar-OM', 'ar-BH', 'ar-JO', 'ar-LB', 'ar-SY', 'ar-IQ', 'ar-YE', 
      'ar-MA', 'ar-DZ', 'ar-TN', 'ar-LY', 'ar-SD', 'ar-PS', 'ar-MR', 'ar-SO', 'ar-DJ', 'ar-KM'
    ];
    const menaOther = ['fa', 'he', 'ps', 'ku', 'az'];

    LANGUAGES.forEach(lang => {
      let groupKey;
      if (indianLangs.includes(lang.code)) {
        groupKey = 'in-regional';
      } else if (saLangs.includes(lang.code)) {
        groupKey = 'za-regional';
      } else if (deLangs.includes(lang.code)) {
        groupKey = 'de-regional';
      } else if (euRegionalLangs.includes(lang.code)) {
        groupKey = 'eu-regional';
      } else if (esRegionalLangs.includes(lang.code)) {
        groupKey = 'es-regional';
      } else if (itRegionalLangs.includes(lang.code)) {
        groupKey = 'it-regional';
      } else if (hispanosphereEs.includes(lang.code)) {
        groupKey = 'hispanosphere';
      } else if (lusospherePt.includes(lang.code)) {
        groupKey = 'lusosphere';
      } else if (arabicGlobal.includes(lang.code)) {
        groupKey = 'arabic-global';
      } else if (menaOther.includes(lang.code)) {
        groupKey = 'mena-other';
      } else if (lang.code.startsWith('zh-Hans')) {
        groupKey = 'zh-Hans';
      } else if (lang.code.startsWith('zh-Hant')) {
        groupKey = 'zh-Hant';
      } else {
        groupKey = lang.code.split('-')[0];
      }

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(lang);
    });
    return groups;
  }, []);

  const baseLanguages = React.useMemo(() => {
    return Object.keys(groupedLanguages).map(base => {
      const group = groupedLanguages[base];
      
      let name, flag;
      if (base === 'in-regional') {
        name = t('tab_indian_langs' as any) || 'Indian Languages';
        flag = '🇮🇳';
      } else if (base === 'za-regional') {
        name = t('tab_sa_langs' as any) || 'South African Languages';
        flag = '🇿🇦';
      } else if (base === 'de-regional') {
        name = t('tab_de_langs' as any) || 'Germanic Languages';
        flag = '🇩🇪';
      } else if (base === 'eu-regional') {
        name = t('tab_regional_langs' as any) || 'Regional Languages';
        flag = '🇪🇺';
      } else if (base === 'es-regional') {
        name = t('tab_es_regional' as any) || 'Spain Regions';
        flag = '🇪🇸';
      } else if (base === 'it-regional') {
        name = t('tab_it_regional' as any) || 'Italy Regions';
        flag = '🇮🇹';
      } else if (base === 'hispanosphere') {
        name = t('tab_latam_es' as any) || 'Español (Global)';
        flag = '🌎';
      } else if (base === 'lusosphere') {
        name = t('tab_lusosphere' as any) || 'Português (Global)';
        flag = '🌍';
      } else if (base === 'arabic-global') {
        name = t('tab_arabic_global' as any) || 'Arabic (Global)';
        flag = '☪️';
      } else if (base === 'mena-other') {
        name = t('tab_mena_langs' as any) || 'MENA (Other)';
        flag = '🕌';
      } else if (base === 'zh-Hans') {
        name = '简体中文';
        flag = '🇨🇳';
      } else if (base === 'zh-Hant') {
        name = '繁體中文';
        flag = '🇭🇰';
      } else {
        // Special case for English: prefer UK name/flag for the group
        if (base === 'en') {
          const uk = group.find(l => l.code === 'en-GB');
          name = 'English';
          flag = uk ? uk.flag : '🇬🇧';
        } else {
          // Prefer the one without a hyphen if it exists, otherwise the first one
          const main = group.find(l => !l.code.includes('-')) || group[0];
          name = main.name.split(' (')[0];
          flag = main.flag;
        }
      }

      return {
        base,
        name,
        flag: flag,
        count: group.length,
        variants: group
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [groupedLanguages, t]);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[120] pointer-events-none flex items-center justify-center">
          <motion.div 
            initial={{ y: '100dvh' }}
            animate={{ y: 0 }}
            exit={{ y: '100dvh' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300, mass: 0.8 }}
            className="w-full h-full bg-slate-50 flex flex-col pointer-events-auto overflow-hidden relative"
          >
            <div className="flex-1 flex flex-col overflow-hidden w-full bg-white">
              {/* Header */}
              <div 
                className="px-6 py-6 border-b border-slate-100 bg-white/90 backdrop-blur-xl sticky top-0 z-20"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}
              >
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => {
                        if (settingsTab === 'main') {
                          onClose();
                        } else {
                          setSettingsTab('main');
                        }
                      }}
                      className="p-4 hover:bg-slate-100 rounded-2xl transition-all active:scale-95 text-slate-500 hover:text-slate-900 group"
                    >
                      {settingsTab === 'main' ? (
                        <X className="w-6 h-6" />
                      ) : (
                        <ChevronRight className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" />
                      )}
                    </button>
                    <div className="flex flex-col">
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-1">
                        {settingsTab === 'main' ? t('settings') : 
                         settingsTab === 'app-language' ? t('app_language') : 
                         settingsTab === 'address-language' ? t('address_language') : 
                         t(settingsTab.replace('-', '_') as any) || settingsTab.replace('-', ' ')}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">
                          {t('configuration_console')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              <div className="max-w-4xl mx-auto pb-safe">
                <AnimatePresence mode="wait">
                  {settingsTab === 'main' && (
                    <motion.div 
                      key="main"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      className="p-5 md:p-6 space-y-5"
                    >
                      {/* Settings Hero Section */}
                      <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-4 md:p-6 mb-4 group">
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
                        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-32 h-32 bg-purple-600/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                          <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center text-white shadow-2xl shrink-0">
                            <Settings className="w-8 h-8 animate-[spin_8s_linear_infinite]" />
                          </div>
                          <div className="text-center md:text-left">
                            <h4 className="text-xl md:text-2xl font-black text-white tracking-tight mb-1 underline decoration-blue-500/50 decoration-4 underline-offset-4">
                              {t('preferences')}
                            </h4>
                            <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] max-w-sm mx-auto md:mx-0 leading-relaxed">
                              {t('configure_agid_desc')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setSettingsTab('home')}
                        className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-slate-50 rounded-2xl transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Home className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-slate-900">{t('home')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('set_primary_location')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('app-language')}
                        className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-slate-50 rounded-2xl transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Globe className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-slate-900">{t('app_language')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('app_language_desc')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                             {LANGUAGES.find(l => l.code === appLanguage)?.name || appLanguage}
                           </span>
                           <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </div>
                      </button>

                      <button 
                        onClick={() => setSettingsTab('app')}
                        className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-slate-50 rounded-2xl transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Smartphone className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-slate-900">{t('app_display')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('app_display_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('location')}
                        className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-slate-50 rounded-2xl transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-slate-900">{t('location_privacy')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('location_privacy_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('offline')}
                        className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-slate-50 rounded-2xl transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Download className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-slate-900">{t('offline_maps')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('offline_maps_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('export')}
                        className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-slate-50 rounded-2xl transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <FileDown className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-slate-900">{t('export_center')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('export_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('about')}
                        className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-slate-50 rounded-2xl transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-slate-900">{t('about_terms')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('about_terms_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('help')}
                        className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-slate-50 rounded-2xl transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Info className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm md:text-base text-slate-900">{t('help')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('help_center_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>
                    </motion.div>
                  )}

                  {settingsTab === 'export' && (
                    <motion.div 
                      key="export"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-5 md:p-6 space-y-6"
                    >
                      <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100">
                        <h4 className="text-sm font-black text-indigo-900 mb-2 uppercase tracking-widest">{t('pro_data_export')}</h4>
                        <p className="text-xs text-indigo-800/70 leading-relaxed mb-6">
                          Download your spatial data in industry-standard formats for GIS, analytics, or navigation.
                        </p>

                        <div className="space-y-4">
                          <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Bookmark className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                  {t('saved_locations_count').replace('{{count}}', String(savedAgids.length))}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              <button 
                                disabled={savedAgids.length === 0}
                                onClick={() => {
                                  const data: ExportData[] = savedAgids.map(a => ({
                                    id: a.id,
                                    lat: a.lat,
                                    lon: a.lng,
                                    name: a.name || a.address,
                                    type: t('saved_point'),
                                    timestamp: new Date().toISOString()
                                  }));
                                  ExportService.exportToGeoJSON(data, `agid_saved_${new Date().getTime()}.geojson`);
                                }}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 flex items-center justify-center gap-2"
                              >
                                <FileDown className="w-3.5 h-3.5" /> {t('export_geojson')}
                              </button>
                              <div className="grid grid-cols-3 gap-2">
                                <button 
                                  disabled={savedAgids.length === 0}
                                  onClick={() => {
                                    const data: ExportData[] = savedAgids.map(a => ({
                                      id: a.id,
                                      lat: a.lat,
                                      lon: a.lng,
                                      name: a.name || a.address,
                                      type: t('saved_point'),
                                      timestamp: new Date().toISOString()
                                    }));
                                    ExportService.exportToCSV(data, `agid_saved_${new Date().getTime()}.csv`);
                                  }}
                                  className="py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                                >
                                  {t('export_csv')}
                                </button>
                                <button 
                                  disabled={savedAgids.length === 0}
                                  onClick={() => {
                                    const data: ExportData[] = savedAgids.map(a => ({
                                      id: a.id,
                                      lat: a.lat,
                                      lon: a.lng,
                                      name: a.name || a.address,
                                      type: t('saved_point'),
                                      timestamp: new Date().toISOString()
                                    }));
                                    ExportService.exportToKML(data, `agid_saved_${new Date().getTime()}.kml`);
                                  }}
                                  className="py-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                                >
                                  {t('export_kml')}
                                </button>
                                <button 
                                  disabled={savedAgids.length === 0}
                                  onClick={() => {
                                    const data: ExportData[] = savedAgids.map(a => ({
                                      id: a.id,
                                      lat: a.lat,
                                      lon: a.lng,
                                      name: a.name || a.address,
                                      type: t('saved_point'),
                                      timestamp: new Date().toISOString()
                                    }));
                                    ExportService.exportToGPX(data, `agid_saved_${new Date().getTime()}.gpx`);
                                  }}
                                  className="py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                                >
                                  {t('export_gpx')}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{t('search_history_label').replace('{{count}}', String(searchHistory.length))}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <button 
                                disabled={searchHistory.length === 0}
                                onClick={() => {
                                  const csvContent = "Query\n" + searchHistory.join("\n");
                                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                  saveAs(blob, `agid_history_${new Date().getTime()}.csv`);
                                }}
                                className="w-full py-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 flex items-center justify-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5" /> {t('download_history_csv')}
                              </button>
                              
                              <div className="relative">
                                <input 
                                  type="file" 
                                  accept=".csv,.json"
                                  className="hidden" 
                                  id="import-history-input"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (evt) => {
                                      const text = evt.target?.result as string;
                                      try {
                                        let imported: string[] = [];
                                        if (file.name.endsWith('.json')) {
                                          imported = JSON.parse(text);
                                        } else {
                                          imported = text.split('\n').slice(1).filter(line => line.trim());
                                        }
                                        const newHistory = Array.from(new Set([...searchHistory, ...imported]));
                                        setSearchHistory(newHistory);
                                        localStorage.setItem('search_history', JSON.stringify(newHistory));
                                        showAlert('Import Successful', `${imported.length} history items imported.`);
                                      } catch (err) {
                                        showAlert('Import Failed', 'The file format was not recognized.');
                                      }
                                    };
                                    reader.readAsText(file);
                                  }}
                                />
                                <label 
                                  htmlFor="import-history-input"
                                  className="w-full py-3 bg-white text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer hover:bg-indigo-50 transition-colors"
                                >
                                  <FileDown className="w-3.5 h-3.5 rotate-180" /> {t('import_history')}
                                </label>
                              </div>
                            </div>
                          </div>

                          <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{t('current_view')}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                if (!mapRef.current) return;
                                const center = mapRef.current.getCenter();
                                const zoom = mapRef.current.getZoom();
                                const data = {
                                  lat: center.lat,
                                  lon: center.lng,
                                  zoom: zoom,
                                  timestamp: new Date().toISOString()
                                };
                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                saveAs(blob, `agid_view_${new Date().getTime()}.json`);
                              }}
                              className="w-full py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                              <Share2 className="w-3.5 h-3.5" /> {t('current_view_coords')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {settingsTab === 'home' && (
                    <motion.div 
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-5 md:p-6 space-y-6"
                    >
                      <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100">
                        <p className="text-sm font-bold text-blue-900 mb-2">{t('home')} AGID</p>
                        <p className="text-xs text-blue-700/70 mb-4 leading-relaxed">
                          {t('home_desc')}
                        </p>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={homeAgid}
                            onChange={(e) => setHomeAgid(e.target.value.toUpperCase())}
                            placeholder="Enter AGID (e.g. JP12345678)"
                            className="flex-1 bg-white border border-blue-200 rounded-xl px-4 py-3 text-sm font-black font-mono focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                          />
                          <button 
                            onClick={() => {
                              if (clickedAgid) setHomeAgid(clickedAgid.id);
                            }}
                            className="px-4 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                          >
                            {t('use_current')}
                          </button>
                        </div>
                      </div>

                      {homeAgid && (
                        <button 
                          onClick={() => jumpToAgid(homeAgid)}
                          className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
                        >
                          {t('jump_to_home')}
                        </button>
                      )}
                    </motion.div>
                  )}

                  {settingsTab === 'app' && (
                    <motion.div 
                      key="app"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-5 md:p-6 space-y-6"
                    >
                      {/* Language Selection */}
                      <section className="space-y-3">
                        <div className="flex items-center gap-2 text-blue-600">
                          <Globe className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">{t('language_settings')}</h3>
                        </div>
                        <div className="grid gap-3">
                          <button 
                            onClick={() => setSettingsTab('app-language')}
                            className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                          >
                            <div className="text-left">
                              <p className="text-sm font-bold text-slate-700">{t('app_language')}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{t('app_language_desc')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                {LANGUAGES.find(l => l.code === appLanguage)?.name || appLanguage}
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                            </div>
                          </button>

                          <button 
                            onClick={() => setSettingsTab('address-language')}
                            className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                          >
                            <div className="text-left">
                              <p className="text-sm font-bold text-slate-700">{t('address_language')}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{t('address_language_desc')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                {addressLanguage === 'local' ? t('local_lang') : (LANGUAGES.find(l => l.code === addressLanguage)?.name || addressLanguage)}
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                            </div>
                          </button>
                        </div>
                      </section>

                      {/* Mode */}
                      <section className="space-y-4">
                        <div className="flex items-center gap-2 text-purple-600">
                          <Smartphone className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">{t('mode')}</h3>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{t('theme')}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{t('theme_desc')}</p>
                          </div>
                          <div className="flex bg-white p-1.5 rounded-xl border border-slate-200">
                            <button 
                              onClick={() => setThemeMode('light')}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                themeMode === 'light' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              {t('light')}
                            </button>
                            <button 
                              onClick={() => setThemeMode('dark')}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                themeMode === 'dark' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              {t('dark')}
                            </button>
                            <button 
                              onClick={() => setThemeMode('system')}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                themeMode === 'system' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              {t('system')}
                            </button>
                          </div>
                        </div>
                      </section>

                      {/* Distance Units & Navigation */}
                      <section className="space-y-4">
                        <div className="flex items-center gap-2 text-amber-600">
                          <Ruler className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">{t('distance_nav')}</h3>
                        </div>
                        <div className="grid gap-4">
                          <div className="p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-700">{t('units')}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{t('units_desc')}</p>
                            </div>
                              <div className="flex bg-white p-1.5 rounded-xl border border-slate-200">
                                {['automatic', 'kilometers', 'miles', 'nautical'].map((unit) => (
                                  <button 
                                    key={unit}
                                    onClick={() => setDistanceUnit(unit as any)}
                                    className={cn(
                                      "flex-1 md:flex-none md:px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                      distanceUnit === unit ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                    )}
                                  >
                                    {unit === 'automatic' ? t('system') : unit === 'kilometers' ? 'KM' : unit === 'miles' ? 'MI' : 'NM'}
                                  </button>
                                ))}
                              </div>
                          </div>

                          <div className="p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Navigation className="w-4 h-4 text-blue-600" />
                                <p className="text-sm font-bold text-slate-700">{t('default_nav_app')}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {[
                                { id: 'google', name: 'Google' },
                                { id: 'apple', name: 'Apple' },
                                { id: 'amap', name: '高徳 (AMap)' },
                                { id: 'baidu', name: '百度 (Baidu)' },
                                { id: 'osmand', name: 'OsmAnd' },
                                { id: 'organic_maps', name: 'Organic' },
                                { id: 'waze', name: 'Waze' }
                              ].map(app => (
                                <button
                                  key={app.id}
                                  onClick={() => setDefaultNavApp(app.id as any)}
                                  className={cn(
                                    "px-4 py-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 active:scale-95",
                                    defaultNavApp === app.id 
                                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" 
                                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                                  )}
                                >
                                  <span className="truncate">{app.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Map Appearance */}
                      <section className="space-y-4 pt-6 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Layers className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">{t('map_appearance')}</h3>
                        </div>
                        <div className="grid gap-4">
                          <div className="flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                              <p className="text-sm font-bold text-slate-700">{t('map_style')}</p>
                              <p className="text-[10px] text-slate-400 font-medium md:hidden">{t('map_style_desc')}</p>
                            </div>
                            <select 
                              value={mapStyle}
                              onChange={(e) => changeStyle(e.target.value)}
                              className="w-full md:w-auto bg-white border border-slate-200 rounded-xl px-4 py-3 md:py-1.5 text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none text-center"
                            >
                              <option value="https://tiles.openfreemap.org/styles/bright">Bright</option>
                              <option value="https://tiles.openfreemap.org/styles/liberty">Liberty</option>
                              <option value="https://tiles.openfreemap.org/styles/positron">Positron</option>
                              <option value="https://tiles.openfreemap.org/styles/dark">Dark</option>
                              <option value="satellite">Satellite</option>
                            </select>
                          </div>
                          
                          <div className="p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100 md:col-span-1">
                            <button 
                              onClick={() => setIs3DEnabled(!is3DEnabled)}
                              className={cn(
                                "w-full flex items-center justify-between p-5 md:p-6 rounded-2xl border transition-all active:scale-[0.98]",
                                is3DEnabled ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-slate-50 border-slate-100"
                              )}
                            >
                              <div className="flex flex-col items-start gap-1">
                                <span className={cn("text-sm font-black uppercase tracking-widest", is3DEnabled ? "text-blue-700" : "text-slate-600")}>{t('3d_display')}</span>
                                <span className="text-[10px] font-bold text-slate-400">{t('3d_display_desc')}</span>
                              </div>
                              <div className={cn("w-3 h-3 rounded-full", is3DEnabled ? "bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]" : "bg-slate-300")} />
                            </button>
                          </div>

                          <div className="p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <RotateCcw className="w-4 h-4 text-slate-500" />
                                <p className="text-sm font-bold text-slate-700">{t('map_tilt')}</p>
                              </div>
                              <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                                {[0, 45, 60].map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => setMapPitch(p)}
                                    className={cn(
                                      "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                      mapPitch === p ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                                    )}
                                  >
                                    {p}°
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-slate-500" />
                                  <p className="text-sm font-bold text-slate-700">{t('grid_opacity')}</p>
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('level')} {gridOpacityLevel}</span>
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                {[1, 2, 3, 4, 5].map((lv) => (
                                  <button
                                    key={lv}
                                    onClick={() => setGridOpacityLevel(lv)}
                                    className={cn(
                                      "flex-1 py-3 rounded-xl transition-all border-2 flex items-center justify-center",
                                      gridOpacityLevel === lv 
                                        ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-100" 
                                        : "bg-white border-slate-100 hover:border-slate-200"
                                    )}
                                  >
                                    <div 
                                      className={cn(
                                        "w-full h-1 rounded-full mx-2",
                                        gridOpacityLevel === lv ? "bg-white/80" : "bg-slate-200"
                                      )}
                                      style={{ opacity: lv / 5 }}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    </motion.div>
                  )}

                  {settingsTab === 'location' && (
                    <motion.div 
                      key="location"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-5 md:p-6 space-y-6"
                    >
                      <section className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <ShieldCheck className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">{t('privacy_security')}</h3>
                        </div>
                        <div className="space-y-3">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                             <p className="text-sm font-bold text-slate-700 mb-1">{t('anonymous_usage')}</p>
                             <p className="text-xs text-slate-500 leading-relaxed">
                               Your AGID searches and location interactions are stored locally on your device and are never transmitted to our servers identifying you.
                             </p>
                          </div>
                          
                          <button 
                            onClick={() => {
                              showConfirm(
                                t('clear_history_title'),
                                t('clear_history_desc'),
                                () => {
                                  clearHistory();
                                  showAlert(t('history_cleared'), t('history_cleared_desc'));
                                }
                              );
                            }}
                            className="w-full p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center justify-between hover:bg-red-100 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <Trash2 className="w-4 h-4" />
                              <span className="text-xs font-black uppercase tracking-widest">{t('clear_all_history')}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100" />
                          </button>
                        </div>
                      </section>
                    </motion.div>
                  )}
                  
                  {settingsTab === 'offline' && (
                    <motion.div 
                      key="offline"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-5 md:p-6 space-y-6"
                    >
                      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                          <Download className="w-10 h-10" />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-900 tracking-tight">{t('offline_capabilities')}</h4>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t('available_pro')}</p>
                        </div>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                          {t('offline_maps_desc')}
                        </p>
                        <button className="px-8 py-3 bg-slate-900 text-white rounded-full font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all">
                          {t('upgrade_pro')}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {settingsTab === 'about' && (
                    <motion.div 
                      key="about"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-5 md:p-6 space-y-4"
                    >
                      <button 
                        onClick={() => setActiveLegalDoc('terms')}
                        className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-all"
                      >
                         <span className="text-xs font-black uppercase tracking-widest text-slate-700">{t('terms_of_service')}</span>
                         <ChevronRight className="w-4 h-4 text-slate-300" />
                      </button>
                      <button 
                        onClick={() => setActiveLegalDoc('privacy')}
                        className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-all"
                      >
                         <span className="text-xs font-black uppercase tracking-widest text-slate-700">{t('privacy_policy')}</span>
                         <ChevronRight className="w-4 h-4 text-slate-300" />
                      </button>
                      <button 
                        onClick={() => setShowLicenses(true)}
                        className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-all"
                      >
                         <span className="text-xs font-black uppercase tracking-widest text-slate-700">{t('open_source_licenses')}</span>
                         <ChevronRight className="w-4 h-4 text-slate-300" />
                      </button>
                    </motion.div>
                  )}

                  {settingsTab === 'help' && (
                    <motion.div 
                      key="help"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-5 md:p-6"
                    >
                       <div className="space-y-4">
                          <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100">
                            <h4 className="text-sm font-black text-blue-900 mb-2 uppercase tracking-widest">{t('how_to_use_agid')}</h4>
                            <p className="text-xs text-blue-800/70 leading-relaxed">
                              {appLanguage === 'ja' 
                                ? 'AGIDは階層型グリッドシステムを使用して、地球上のあらゆる場所を人間が読める10文字のコードに解決します。' 
                                : 'AGID utilizes a hierarchical grid system to resolve any location on Earth into a human-readable 10-character code.'}
                            </p>
                          </div>
                          
                          <div className="grid gap-3">
                            <details className="group bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all">
                              <summary className="p-4 list-none cursor-pointer flex items-center justify-between group-hover:bg-slate-50">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 group-open:text-blue-600">{t('common_questions')}</span>
                                <BookOpen className="w-4 h-4 text-slate-300 group-open:text-blue-500 group-open:rotate-12 transition-all" />
                              </summary>
                              <div className="p-4 pt-0 text-xs text-slate-500 space-y-3 leading-relaxed border-t border-slate-50 mt-2">
                                <div className="space-y-1">
                                  <p className="font-bold text-slate-700">Q: AGIDとは何ですか？</p>
                                  <p>A: 地球上の3m×3mの区画に割り当てられた一意の番地システムです。住所がない場所でも正確に位置を特定できます。</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="font-bold text-slate-700">Q: オフラインで使用できますか？</p>
                                  <p>A: 地図の表示にはインターネットが必要ですが、一度読み込んだエリアや保存済みの地点はキャッシュされます。Pro版ではオフラインマップが提供される予定です。</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="font-bold text-slate-700">Q: 精度はどのくらいですか？</p>
                                  <p>A: 世界中で数センチメートル単位の計算精度を持ち、グリッド表示は3m四方（AGID-Standard）で提供されます。</p>
                                </div>
                              </div>
                            </details>

                            <details className="group bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all">
                              <summary className="p-4 list-none cursor-pointer flex items-center justify-between group-hover:bg-slate-50">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 group-open:text-emerald-600">{t('system_status')}</span>
                                <Activity className="w-4 h-4 text-slate-300 group-open:text-emerald-500 group-open:animate-pulse transition-all" />
                              </summary>
                              <div className="p-4 pt-0 text-xs text-slate-500 space-y-3 leading-relaxed border-t border-slate-50 mt-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold">Core API</span>
                                  <span className="text-emerald-500 font-black">OPERATIONAL</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold">Tile Engine</span>
                                  <span className="text-emerald-500 font-black">99.9% UP</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold">Grid Resolver</span>
                                  <span className="text-emerald-500 font-black">STABLE</span>
                                </div>
                                <div className="pt-2">
                                  <button 
                                    onClick={fetchQualityReport}
                                    className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                  >
                                    View Data Quality Report
                                  </button>
                                </div>
                              </div>
                            </details>

                            <a 
                              href="mailto:support@agid-geospatial.example"
                              className="p-4 bg-white rounded-2xl border border-slate-100 text-left flex items-center justify-between group hover:bg-slate-900 hover:border-slate-900 transition-all"
                            >
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 group-hover:text-white">{t('contact_support')}</span>
                               <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-white group-hover:translate-x-1 transition-all" />
                            </a>
                          </div>
                       </div>
                    </motion.div>
                  )}

                  {settingsTab === 'app-language' && (
                    <motion.div 
                      key="app-language"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-5 md:p-6"
                    >
                      <AnimatePresence mode="wait">
                        {!selectedBaseLang ? (
                          <motion.div 
                            key="bases"
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -10, opacity: 0 }}
                            className="grid gap-2"
                          >
                            {baseLanguages.filter(bl => bl.variants.some(l => Object.keys(TRANSLATIONS).includes(l.code))).map((bl) => (
                              <button
                                key={bl.base}
                                onClick={() => {
                                  if (bl.count > 1) {
                                    setSelectedBaseLang(bl.base);
                                  } else {
                                    setAppLanguage(bl.variants[0].code);
                                    setSettingsTab('main');
                                  }
                                }}
                                className={cn(
                                  "w-full p-4 rounded-2xl border flex items-center justify-between transition-all group",
                                  appLanguage.startsWith(bl.base) 
                                    ? "bg-blue-50 border-blue-200 text-blue-900 shadow-sm" 
                                    : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xl">{bl.flag}</span>
                                  <span className="text-sm font-bold">{bl.name}</span>
                                  {bl.count > 1 && (
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                      {bl.count} Regions
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {appLanguage.startsWith(bl.base) && !selectedBaseLang && <Check className="w-4 h-4 text-blue-600" />}
                                  {bl.count > 1 && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />}
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="variants"
                            initial={{ x: 10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 10, opacity: 0 }}
                            className="space-y-4"
                          >
                            <button 
                              onClick={() => setSelectedBaseLang(null)}
                              className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors mb-4"
                            >
                              <ChevronRight className="w-3 h-3 rotate-180" />
                              Back to Languages
                            </button>
                            
                            <div className="grid gap-2">
                              {groupedLanguages[selectedBaseLang].filter(l => Object.keys(TRANSLATIONS).includes(l.code)).map((lang) => (
                                <button
                                  key={lang.code}
                                  onClick={() => {
                                    setAppLanguage(lang.code);
                                    setSettingsTab('main');
                                    setSelectedBaseLang(null);
                                  }}
                                  className={cn(
                                    "w-full p-4 rounded-2xl border flex items-center justify-between transition-all",
                                    appLanguage === lang.code 
                                      ? "bg-blue-600 border-blue-700 text-white shadow-lg" 
                                      : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl">{lang.flag}</span>
                                    <div className="text-left">
                                      <p className="text-sm font-bold">{lang.name}</p>
                                      <p className={cn("text-[10px] font-bold uppercase", appLanguage === lang.code ? "text-blue-200" : "text-slate-400")}>
                                        {lang.country}
                                      </p>
                                    </div>
                                  </div>
                                  {appLanguage === lang.code && <Check className="w-4 h-4 text-white" />}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {settingsTab === 'address-language' && (
                    <motion.div 
                      key="address-language"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-5 md:p-6"
                    >
                      <AnimatePresence mode="wait">
                        {!selectedBaseLang ? (
                          <motion.div 
                            key="bases"
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -10, opacity: 0 }}
                            className="grid gap-2"
                          >
                            <button
                              onClick={() => {
                                setAddressLanguage('local');
                                setSettingsTab('main');
                              }}
                              className={cn(
                                "w-full p-4 rounded-2xl border flex items-center justify-between transition-all",
                                addressLanguage === 'local' 
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm" 
                                  : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">📍</span>
                                <span className="text-sm font-bold">{t('local_lang')}</span>
                              </div>
                              {addressLanguage === 'local' && <Check className="w-4 h-4 text-emerald-600" />}
                            </button>

                            {baseLanguages.map((bl) => (
                              <button
                                key={bl.base}
                                onClick={() => {
                                  if (bl.count > 1) {
                                    setSelectedBaseLang(bl.base);
                                  } else {
                                    setAddressLanguage(bl.variants[0].code);
                                    setSettingsTab('main');
                                  }
                                }}
                                className={cn(
                                  "w-full p-4 rounded-2xl border flex items-center justify-between transition-all group",
                                  addressLanguage.startsWith(bl.base) 
                                    ? "bg-blue-50 border-blue-200 text-blue-900 shadow-sm" 
                                    : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xl">{bl.flag}</span>
                                  <span className="text-sm font-bold">{bl.name}</span>
                                  {bl.count > 1 && (
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                      {bl.count} Regions
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {addressLanguage.startsWith(bl.base) && !selectedBaseLang && <Check className="w-4 h-4 text-blue-600" />}
                                  {bl.count > 1 && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />}
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="variants"
                            initial={{ x: 10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 10, opacity: 0 }}
                            className="space-y-4"
                          >
                            <button 
                              onClick={() => setSelectedBaseLang(null)}
                              className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors mb-4"
                            >
                              <ChevronRight className="w-3 h-3 rotate-180" />
                              Back to Languages
                            </button>
                            
                            <div className="grid gap-2">
                              {groupedLanguages[selectedBaseLang].map((lang) => (
                                <button
                                  key={lang.code}
                                  onClick={() => {
                                    setAddressLanguage(lang.code);
                                    setSettingsTab('main');
                                    setSelectedBaseLang(null);
                                  }}
                                  className={cn(
                                    "w-full p-4 rounded-2xl border flex items-center justify-between transition-all",
                                    addressLanguage === lang.code 
                                      ? "bg-blue-600 border-blue-700 text-white shadow-lg" 
                                      : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl">{lang.flag}</span>
                                    <div className="text-left">
                                      <p className="text-sm font-bold">{lang.name}</p>
                                      <p className={cn("text-[10px] font-bold uppercase", addressLanguage === lang.code ? "text-blue-200" : "text-slate-400")}>
                                        {lang.country}
                                      </p>
                                    </div>
                                  </div>
                                  {addressLanguage === lang.code && <Check className="w-4 h-4 text-white" />}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom Version Info */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 shrink-0 select-none">
              <div className="max-w-4xl mx-auto flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>AGID Engine 4.0.2</span>
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                  STABLE RELEASE
                </span>
                <span>© 2026 GEOGRID</span>
              </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
