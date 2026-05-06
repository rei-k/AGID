
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
  Check 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { LANGUAGES } from '../lib/addressUtils';
import { MAJOR_CATEGORIES, MAP_STYLES } from '../constants/appConstants';
import { ExportService, ExportData } from '../services/ExportService';
import { saveAs } from 'file-saver';
import maplibregl from 'maplibre-gl';

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
  clickedAgid: any;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
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
  clickedAgid,
  showConfirm,
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
  // Removed useTranslation

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 1 }}
          className="fixed inset-0 z-[120] pointer-events-auto bg-white"
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div 
              className="px-6 py-4 md:py-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-10"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}
            >
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => settingsTab === 'main' ? onClose() : setSettingsTab('main')}
                  className="p-2 hover:bg-slate-50 rounded-none transition-all active:scale-95 text-slate-400 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex flex-col">
                  <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">
                    {settingsTab === 'main' ? t('settings') : 
                     settingsTab === 'app-language' ? t('app_language') : 
                     settingsTab === 'address-language' ? t('address_language') : 
                     t(settingsTab.replace('-', '_') as any) || settingsTab.replace('-', ' ')}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 bg-blue-500 rounded-none animate-pulse" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{t('global_preferences')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative pb-12">
              <div className="max-w-3xl mx-auto pb-safe">
                <AnimatePresence mode="wait">
                  {settingsTab === 'main' && (
                    <motion.div 
                      key="main"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      className="p-6 space-y-6"
                    >
                      {/* Settings Hero Section */}
                      <div className="relative overflow-hidden bg-slate-900 rounded-none p-8 md:p-12 mb-8 group">
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-blue-600/20 rounded-none blur-3xl group-hover:scale-110 transition-transform duration-1000" />
                        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-48 h-48 bg-purple-600/20 rounded-none blur-3xl group-hover:scale-110 transition-transform duration-1000" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                          <div className="w-24 h-24 bg-white/10 backdrop-blur-xl border border-white/20 rounded-none flex items-center justify-center text-white shadow-2xl shrink-0">
                            <Settings className="w-10 h-10 animate-[spin_8s_linear_infinite]" />
                          </div>
                          <div className="text-center md:text-left">
                            <h4 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2 underline decoration-blue-500/50 decoration-4 underline-offset-4">
                              {t('preferences')}
                            </h4>
                            <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] max-w-md mx-auto md:mx-0">
                              {t('configure_agid_desc')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setSettingsTab('home')}
                        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-none transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-none flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Home className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm md:text-base text-slate-900">{t('home')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('set_primary_location')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('app')}
                        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-none transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-none flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Smartphone className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm md:text-base text-slate-900">{t('app_display')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('app_display_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('location')}
                        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-none transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-none flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <ShieldCheck className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm md:text-base text-slate-900">{t('location_privacy')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('location_privacy_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('offline')}
                        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-none transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-none flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Download className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm md:text-base text-slate-900">{t('offline_maps')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('offline_maps_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('export')}
                        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-none transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-none flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <FileDown className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm md:text-base text-slate-900">{t('export_center')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('export_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('about')}
                        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-none transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-none flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm md:text-base text-slate-900">{t('about_terms')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('about_terms_desc')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => setSettingsTab('help')}
                        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-none transition-colors group active:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-none flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
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
                      className="p-8 space-y-10"
                    >
                      <div className="bg-indigo-50 p-6 rounded-none border border-indigo-100">
                        <h4 className="text-sm font-black text-indigo-900 mb-2 uppercase tracking-widest">{t('pro_data_export')}</h4>
                        <p className="text-xs text-indigo-800/70 leading-relaxed mb-6">
                          Download your spatial data in industry-standard formats for GIS, analytics, or navigation.
                        </p>

                        <div className="space-y-4">
                          <div className="p-5 bg-white rounded-none border border-indigo-100 shadow-sm">
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
                                    type: 'Saved Point',
                                    timestamp: new Date().toISOString()
                                  }));
                                  ExportService.exportToGeoJSON(data, `agid_saved_${new Date().getTime()}.geojson`);
                                }}
                                className="w-full py-3 bg-indigo-600 text-white rounded-none text-[10px] font-black uppercase tracking-widest disabled:opacity-30 flex items-center justify-center gap-2"
                              >
                                <FileDown className="w-3.5 h-3.5" /> {t('export_geojson')}
                              </button>
                              <div className="grid grid-cols-2 gap-2">
                                <button 
                                  disabled={savedAgids.length === 0}
                                  onClick={() => {
                                    const data: ExportData[] = savedAgids.map(a => ({
                                      id: a.id,
                                      lat: a.lat,
                                      lon: a.lng,
                                      name: a.name || a.address,
                                      type: 'Saved Point',
                                      timestamp: new Date().toISOString()
                                    }));
                                    ExportService.exportToCSV(data, `agid_saved_${new Date().getTime()}.csv`);
                                  }}
                                  className="py-3 bg-slate-900 text-white rounded-none text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
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
                                      type: 'Saved Point',
                                      timestamp: new Date().toISOString()
                                    }));
                                    ExportService.exportToKML(data, `agid_saved_${new Date().getTime()}.kml`);
                                  }}
                                  className="py-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-none text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                                >
                                  {t('export_kml')}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="p-5 bg-white rounded-none border border-indigo-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Search History ({searchHistory.length})</span>
                              </div>
                            </div>
                            <button 
                              disabled={searchHistory.length === 0}
                              onClick={() => {
                                const csvContent = "Query\n" + searchHistory.join("\n");
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                saveAs(blob, `agid_history_${new Date().getTime()}.csv`);
                              }}
                              className="w-full py-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-none text-[10px] font-black uppercase tracking-widest disabled:opacity-30 flex items-center justify-center gap-2"
                            >
                              <Download className="w-3.5 h-3.5" /> Download History CSV
                            </button>
                          </div>

                          <div className="p-5 bg-white rounded-none border border-indigo-100 shadow-sm">
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
                              className="w-full py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-none text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                              <Share2 className="w-3.5 h-3.5" /> Save Current Coordinates
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
                      className="p-8 space-y-8"
                    >
                      <div className="bg-blue-50 p-6 rounded-none border border-blue-100">
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
                            className="flex-1 bg-white border border-blue-200 rounded-none px-4 py-3 text-sm font-black font-mono focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                          />
                          <button 
                            onClick={() => {
                              if (clickedAgid) setHomeAgid(clickedAgid.id);
                            }}
                            className="px-4 py-3 bg-blue-600 text-white rounded-none font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                          >
                            {t('use_current')}
                          </button>
                        </div>
                      </div>

                      {homeAgid && (
                        <button 
                          onClick={() => jumpToAgid(homeAgid)}
                          className="w-full py-4 bg-slate-900 text-white rounded-none font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
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
                      className="p-8 space-y-10"
                    >
                      {/* Language Selection */}
                      <section className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-600">
                          <Globe className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">{t('language_settings')}</h3>
                        </div>
                        <div className="grid gap-3">
                          <button 
                            onClick={() => setSettingsTab('app-language')}
                            className="p-4 bg-slate-50 rounded-none border border-slate-100 flex items-center justify-between hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                          >
                            <div className="text-left">
                              <p className="text-sm font-bold text-slate-700">{t('app_language')}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{t('app_language_desc')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-none">
                                {LANGUAGES.find(l => l.code === appLanguage)?.name || appLanguage}
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                            </div>
                          </button>

                          <button 
                            onClick={() => setSettingsTab('address-language')}
                            className="p-4 bg-slate-50 rounded-none border border-slate-100 flex items-center justify-between hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                          >
                            <div className="text-left">
                              <p className="text-sm font-bold text-slate-700">{t('address_language')}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{t('address_language_desc')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-none">
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
                        <div className="p-4 bg-slate-50 rounded-none border border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{t('theme')}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{t('theme_desc')}</p>
                          </div>
                          <div className="flex bg-white p-1.5 rounded-none border border-slate-200">
                            <button 
                              onClick={() => setThemeMode('light')}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-none text-[10px] font-black uppercase tracking-widest transition-all",
                                themeMode === 'light' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              {t('light')}
                            </button>
                            <button 
                              onClick={() => setThemeMode('dark')}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-none text-[10px] font-black uppercase tracking-widest transition-all",
                                themeMode === 'dark' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              {t('dark')}
                            </button>
                            <button 
                              onClick={() => setThemeMode('system')}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-none text-[10px] font-black uppercase tracking-widest transition-all",
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
                          <div className="p-4 md:p-6 bg-slate-50 rounded-none border border-slate-100 flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-700">{t('units')}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{t('units_desc')}</p>
                            </div>
                            <div className="flex bg-white p-1.5 rounded-none border border-slate-200">
                              {['automatic', 'kilometers', 'miles'].map((unit) => (
                                <button 
                                  key={unit}
                                  onClick={() => setDistanceUnit(unit as any)}
                                  className={cn(
                                    "flex-1 md:flex-none md:px-5 py-3 rounded-none text-[10px] font-black uppercase tracking-widest transition-all",
                                    distanceUnit === unit ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                  )}
                                >
                                  {unit === 'automatic' ? t('system') : unit === 'kilometers' ? 'KM' : 'MI'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="p-4 md:p-6 bg-slate-50 rounded-none border border-slate-100 space-y-4">
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
                                    "px-4 py-4 rounded-none text-xs font-bold transition-all border flex items-center justify-center gap-2 active:scale-95",
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
                          <div className="flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between p-4 md:p-6 bg-slate-50 rounded-none border border-slate-100">
                            <div>
                              <p className="text-sm font-bold text-slate-700">{t('map_style')}</p>
                              <p className="text-[10px] text-slate-400 font-medium md:hidden">{t('map_style_desc')}</p>
                            </div>
                            <select 
                              value={mapStyle}
                              onChange={(e) => changeStyle(e.target.value)}
                              className="w-full md:w-auto bg-white border border-slate-200 rounded-none px-4 py-3 md:py-1.5 text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none text-center"
                            >
                              <option value="https://tiles.openfreemap.org/styles/bright">Bright</option>
                              <option value="https://tiles.openfreemap.org/styles/liberty">Liberty</option>
                              <option value="https://tiles.openfreemap.org/styles/positron">Positron</option>
                              <option value="https://tiles.openfreemap.org/styles/dark">Dark</option>
                              <option value="satellite">Satellite</option>
                            </select>
                          </div>
                          
                          <div className="p-4 md:p-6 bg-slate-50 rounded-none border border-slate-100 md:col-span-1">
                            <button 
                              onClick={() => setIs3DEnabled(!is3DEnabled)}
                              className={cn(
                                "w-full flex items-center justify-between p-5 md:p-6 rounded-none border transition-all active:scale-[0.98]",
                                is3DEnabled ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-slate-50 border-slate-100"
                              )}
                            >
                              <div className="flex flex-col items-start gap-1">
                                <span className={cn("text-sm font-black uppercase tracking-widest", is3DEnabled ? "text-blue-700" : "text-slate-600")}>{t('3d_display')}</span>
                                <span className="text-[10px] font-bold text-slate-400">{t('3d_display_desc')}</span>
                              </div>
                              <div className={cn("w-3 h-3 rounded-none", is3DEnabled ? "bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]" : "bg-slate-300")} />
                            </button>
                          </div>

                          <div className="p-4 md:p-6 bg-slate-50 rounded-none border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <RotateCcw className="w-4 h-4 text-slate-500" />
                                <p className="text-sm font-bold text-slate-700">{t('map_tilt')}</p>
                              </div>
                              <div className="flex bg-white p-1 rounded-none border border-slate-200">
                                {[0, 45, 60].map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => setMapPitch(p)}
                                    className={cn(
                                      "px-4 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest transition-all",
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
                                      "flex-1 py-3 rounded-none transition-all border-2 flex items-center justify-center",
                                      gridOpacityLevel === lv 
                                        ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-100" 
                                        : "bg-white border-slate-100 hover:border-slate-200"
                                    )}
                                  >
                                    <div 
                                      className={cn(
                                        "w-full h-1 rounded-none mx-2",
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
                      className="p-8 space-y-10"
                    >
                      <section className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-600">
                          <ShieldCheck className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">Permissions</h3>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-none border border-slate-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-none flex items-center justify-center text-slate-400 shadow-sm">
                                <MapPin className="w-5 h-5" />
                              </div>
                              <span className="text-sm font-bold text-slate-700">Geolocation</span>
                            </div>
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-none">Enabled</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            AGID uses your location to encode the grid cell you are currently in and to provide navigation guidance. Your location data is processed locally and never stored on our servers.
                          </p>
                        </div>
                      </section>

                      <section className="space-y-4">
                        <div className="flex items-center gap-2 text-red-600">
                          <Database className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">Data Management</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => {
                              showConfirm('Clear Data', 'Are you sure you want to clear all saved AGIDs?', () => {
                                setSavedAgids([]);
                                localStorage.removeItem('saved_agids');
                              });
                            }}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-red-50 border border-red-100 rounded-none hover:bg-red-100 transition-colors group"
                          >
                            <Trash2 className="w-6 h-6 text-red-500 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Clear Saved</span>
                          </button>
                          <button 
                            onClick={() => {
                              showConfirm('Reset Settings', 'Reset all preferences to default?', () => {
                                localStorage.clear();
                                window.location.reload();
                              });
                            }}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-50 border border-slate-100 rounded-none hover:bg-slate-100 transition-colors group"
                          >
                            <History className="w-6 h-6 text-slate-500 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Reset All</span>
                          </button>
                        </div>
                      </section>

                      <section className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-900">
                          <BookOpen className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">Legal & Privacy</h3>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-none border border-slate-100 space-y-4">
                          <button 
                            onClick={() => setActiveLegalDoc('privacy')}
                            className="w-full flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3">
                              <ShieldCheck className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                              <span className="text-sm font-bold text-slate-700">Privacy Policy</span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                          </button>
                          <div className="h-px bg-slate-200" />
                          <button 
                            onClick={() => setActiveLegalDoc('terms')}
                            className="w-full flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3">
                              <Scale className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
                              <span className="text-sm font-bold text-slate-700">Terms of Service</span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
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
                      className="p-8 space-y-8"
                    >
                      <div className="bg-amber-50 p-8 rounded-none border border-amber-100 text-center space-y-6">
                        <div className="w-20 h-20 bg-white rounded-none flex items-center justify-center mx-auto text-amber-600 shadow-xl shadow-amber-900/5">
                          <Download className="w-10 h-10" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-amber-900 mb-2">Offline Maps</h4>
                          <p className="text-sm font-bold text-amber-700/60 leading-relaxed">
                            Download map areas to use AGID without an internet connection.
                          </p>
                        </div>
                        <div className="p-4 bg-white/50 rounded-none text-[10px] font-black text-amber-600 uppercase tracking-widest">
                          Feature coming soon
                        </div>
                      </div>

                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Current Cache</p>
                        <div className="flex items-center justify-between p-5 bg-slate-50 rounded-none border border-slate-100">
                          <div className="flex items-center gap-3">
                            <Database className="w-5 h-5 text-slate-400" />
                            <span className="text-sm font-bold text-slate-700">Tile Cache</span>
                          </div>
                          <span className="text-xs font-black text-slate-400">12.4 MB</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {settingsTab === 'about' && (
                    <motion.div 
                      key="about"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-8 space-y-10"
                    >
                      <div className="text-center space-y-4">
                        <div className="w-24 h-24 bg-slate-900 rounded-none flex items-center justify-center mx-auto text-white shadow-2xl">
                          <Grid3X3 className="w-12 h-12" />
                        </div>
                        <div>
                          <h4 className="text-2xl font-black text-slate-900 tracking-tighter">AGID</h4>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Version 2.4.0-PRO</p>
                        </div>
                      </div>

                      <div className="p-8 bg-slate-900 rounded-none text-white shadow-xl space-y-6 text-left">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Data Quality & Health</h5>
                          <Activity className={cn("w-4 h-4 text-white/40", isQualityLoading && "animate-pulse")} />
                        </div>
                        
                        <div className="space-y-4">
                          <p className="text-[10px] text-white/60 font-medium leading-relaxed">
                            Our AI-powered monitoring system periodically sweeps global datasets (Elevation, Geocoding, Postal) to ensure precision and source availability.
                          </p>
                          <button 
                            onClick={fetchQualityReport}
                            disabled={isQualityLoading}
                            className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-none text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                          >
                            {isQualityLoading ? 'Running AI Sweep...' : 'Generate IA Quality Report'}
                            {!isQualityLoading && <Sparkles className="w-3 h-3 group-hover:scale-125 transition-transform" />}
                          </button>
                        </div>
                      </div>

                      <div className="p-8 bg-slate-50 rounded-none border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Global Coverage</h5>
                          <BarChart3 className="w-4 h-4 text-slate-300" />
                        </div>
                        <div className="space-y-5">
                          {MAJOR_CATEGORIES.slice(0, 3).map(cat => {
                            const stats = registryStats.regionStats[cat.id];
                            if (!stats || stats.total === 0) return null;
                            const percentage = Math.round((stats.total / registryStats.globalStats.total) * 100);
                            return (
                              <div key={cat.id} className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                  <span>{cat.name}</span>
                                  <span className="text-white/60">{percentage}%</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-none overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    className="h-full bg-blue-500 rounded-none"
                                  />
                                </div>
                              </div>
                            );
                          })}
                          <button 
                            onClick={() => setShowResources(true)}
                            className="w-full mt-4 py-4 bg-white/5 hover:bg-white/10 rounded-none text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
                          >
                            Detailed Global Resources
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setShowLicenses(true)}
                            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-colors"
                          >
                            Licenses
                          </button>
                          <button 
                            onClick={() => setActiveLegalDoc('privacy')}
                            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-colors"
                          >
                            Privacy
                          </button>
                          <button 
                            onClick={() => setActiveLegalDoc('terms')}
                            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-colors"
                          >
                            Terms
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {settingsTab === 'help' && (
                    <motion.div 
                      key="help"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-8 space-y-10"
                    >
                       <section>
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <div className="w-1 h-3 bg-blue-600 rounded-full" />
                            What is AGID? (AGIDとは)
                          </h3>
                          <div className="bg-slate-50 rounded-none p-5 border border-slate-100 text-sm leading-relaxed text-slate-600 font-medium">
                            <p>
                              <strong className="text-slate-900 font-bold">Absolute Global Identity (AGID)</strong> は、地球上のすべての場所（4m×4mのグリッド）に付与された不変で唯一のIDです。住所のない海の上や山奥でも、確定的な位置を特定することができます。
                            </p>
                          </div>
                        </section>

                        <section>
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                             <div className="w-1 h-3 bg-blue-600 rounded-full" />
                             Device View Standards (表示基準)
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                              { icon: Smartphone, label: "Smartphone", detail: "直径 約60m" },
                              { icon: Box, label: "Tablet", detail: "直径 約100m" },
                              { icon: Globe, label: "PC", detail: "半径 80m (直径160m)" }
                            ].map((device, idx) => (
                              <div key={idx} className="bg-slate-50 border border-slate-100 rounded-none p-4 flex flex-col items-center text-center">
                                <device.icon className="w-5 h-5 text-slate-400 mb-2" />
                                <span className="text-[10px] font-black text-slate-900 uppercase mb-1">{device.label}</span>
                                <span className="text-[10px] font-bold text-blue-600">{device.detail}</span>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section>
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <div className="w-1 h-3 bg-blue-600 rounded-full" />
                            Basic Navigation (基本操作)
                          </h3>
                          <ul className="grid grid-cols-1 gap-3">
                            {[
                              { icon: MapPin, label: "Click to Select", desc: "グリッドをクリックしてその場所のIDと住所を表示します。" },
                              { icon: Search, label: "Smart Search", desc: "AGID、住所、地名などで直接検索できます。" },
                              { icon: LocateFixed, label: "My Location", desc: "GPSを使用して現在地のAGIDを特定します。" },
                              { icon: Layers, label: "Layers & Tilt", desc: "地形（3D）や航空写真、傾きを調整して視認性を高めます。" }
                            ].map((item, idx) => (
                              <li key={idx} className="flex gap-4 p-4 rounded-none bg-slate-50 border border-slate-100 group">
                                <div className="w-8 h-8 rounded-none bg-white shadow-sm flex items-center justify-center shrink-0">
                                  <item.icon className="w-4 h-4 text-blue-500" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900 mb-0.5">{item.label}</h4>
                                  <p className="text-[10px] font-medium text-slate-500 leading-normal">{item.desc}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </section>
                    </motion.div>
                  )}

                  {(settingsTab === 'app-language' || settingsTab === 'address-language') && (
                    <motion.div 
                      key="language-selection"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="p-6 space-y-4"
                    >
                      <div className="grid gap-2">
                        {settingsTab === 'address-language' && (
                          <button
                            key="local"
                            onClick={() => {
                              setAddressLanguage('local');
                              localStorage.setItem('agid_address_language', 'local');
                              setSettingsTab('app');
                            }}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-none border transition-all text-left mb-2",
                              addressLanguage === 'local'
                                ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500/10" 
                                : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                            )}
                          >
                            <div>
                              <p className={cn("text-sm font-bold", addressLanguage === 'local' ? "text-blue-700" : "text-slate-700")}>
                                {t('local_lang')}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">{t('local_lang_desc')}</p>
                            </div>
                            {addressLanguage === 'local' && (
                              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        )}
                        {LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              if (settingsTab === 'app-language') {
                                setAppLanguage(lang.code);
                                localStorage.setItem('agid_app_language', lang.code);
                              } else {
                                setAddressLanguage(lang.code);
                                localStorage.setItem('agid_address_language', lang.code);
                              }
                              setSettingsTab('app');
                            }}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-none border transition-all text-left",
                              (settingsTab === 'app-language' ? appLanguage === lang.code : addressLanguage === lang.code)
                                ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500/10" 
                                : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                            )}
                          >
                            <div>
                              <p className={cn("text-sm font-bold", (settingsTab === 'app-language' ? appLanguage === lang.code : addressLanguage === lang.code) ? "text-blue-700" : "text-slate-700")}>
                                {lang.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">{lang.country}</p>
                            </div>
                            {(settingsTab === 'app-language' ? appLanguage === lang.code : addressLanguage === lang.code) && (
                              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">Version 2.4.0 (Stable)</p>
              <button 
                onClick={onClose}
                className="w-full md:w-auto px-12 py-4 md:py-3 bg-slate-900 text-white rounded-none font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
