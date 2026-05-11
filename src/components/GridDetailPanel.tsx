
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Target, 
  ChevronDown, 
  X, 
  Check, 
  Copy, 
  Maximize2, 
  Key, 
  QrCode, 
  ArrowUpRight, 
  Waves, 
  Flag, 
  Globe, 
  Bookmark, 
  Zap, 
  Download,
  Truck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { QRCodeCanvas } from 'qrcode.react';
import { LANGUAGES, COUNTRY_LANGUAGES, generateInternationalShippingLabel } from '../lib/addressUtils';
import { AddressRenderer, createCanonicalAddress } from '../lib/addressRendering';

interface GridDetailPanelProps {
  clickedAgid: any;
  isAgidPanelCollapsed: boolean;
  setIsAgidPanelCollapsed: (c: boolean) => void;
  isAgidPinnedToGps: boolean;
  setIsAgidPinnedToGps: (p: boolean) => void;
  isManualSelection: boolean;
  setIsManualSelection: (m: boolean) => void;
  setClickedAgid: (a: any) => void;
  setClickedAddress: (addr: string) => void;
  isQrVisible: boolean;
  setIsQrVisible: (v: boolean) => void;
  clickedAddress: string;
  clickedAddressMap: Record<string, string>;
  clickedAddressTab: string;
  setClickedAddressTab: (t: string) => void;
  clickedAddressTranslated: string;
  clickedAddressDetails: any;
  clickedActiveLangs: string[];
  copied: string | null;
  setCopied: (s: string | null) => void;
  userLocation: { lat: number, lng: number } | null;
  mapRef: React.MutableRefObject<any>;
  mapPitch: number;
  getDeviceZoom: () => number;
  encodeAGID: (lat: number, lng: number) => any;
  reverseGeocode: (lat: number, lng: number, prefix: string, isSea: boolean, force?: boolean) => void;
  fetchAddressForLang: (lat: number, lon: number, langCode: string, isNative: boolean, countryCode: string, force?: boolean) => void;
  saveAgid: (agid: any) => void;
  setShowLocationAnalysis: (s: boolean) => void;
  showLocationAnalysis: boolean;
  saveQrCode: () => void;
  setDestination: (d: any) => void;
  setDestinationQuery: (q: string) => void;
  setIsRoutePlanning: (r: boolean) => void;
  setIsNavigating: (n: boolean) => void;
  setOrigin: (o: any) => void;
  setOriginQuery: (q: string) => void;
  fastJapaneseTransliterate: (text: string) => string;
  showAlert: (title: string, message: string) => void;
  showPostalCodeLab: boolean;
  setShowPostalCodeLab: (s: boolean) => void;
  showGeoArchitect: boolean;
  setShowGeoArchitect: (s: boolean) => void;
  t: (key: string) => string;
}

export const GridDetailPanel: React.FC<GridDetailPanelProps> = ({
  clickedAgid,
  isAgidPanelCollapsed,
  setIsAgidPanelCollapsed,
  isAgidPinnedToGps,
  setIsAgidPinnedToGps,
  isManualSelection,
  setIsManualSelection,
  setClickedAgid,
  setClickedAddress,
  isQrVisible,
  setIsQrVisible,
  clickedAddress,
  clickedAddressMap,
  clickedAddressTab,
  setClickedAddressTab,
  clickedAddressTranslated,
  clickedAddressDetails,
  clickedActiveLangs,
  copied,
  setCopied,
  userLocation,
  mapRef,
  mapPitch,
  getDeviceZoom,
  encodeAGID,
  reverseGeocode,
  fetchAddressForLang,
  saveAgid,
  setShowLocationAnalysis,
  showLocationAnalysis,
  saveQrCode,
  setDestination,
  setDestinationQuery,
  setIsRoutePlanning,
  setIsNavigating,
  setOrigin,
  setOriginQuery,
  fastJapaneseTransliterate,
  showAlert,
  t
}) => {
  const [shippingLabel, setShippingLabel] = React.useState<string>("");

  // Move derived constants and hooks to the top to satisfy Rules of Hooks
  const countryCodeFromPrefix = (clickedAgid?.prefix || "").toLowerCase();
  const countryCodeFromId = (clickedAgid?.id?.slice(0, 2) || "").toLowerCase();
  const countryCodeFromDetails = (clickedAddressDetails?.country_code || "").toLowerCase();
  const countryCode = countryCodeFromPrefix || countryCodeFromDetails || countryCodeFromId || "";
  
  const officialLangs = React.useMemo(() => {
    const langs = [...(COUNTRY_LANGUAGES[countryCode] || ['en'])];
    if ((countryCode === 'jp' || countryCodeFromDetails === 'jp') && !langs.includes('ja')) {
      langs.unshift('ja');
    }
    return langs;
  }, [countryCode, countryCodeFromDetails]);

  const displayTabs = React.useMemo(() => Array.from(new Set([
    ...officialLangs,
    'intl_en',
    'carrier'
  ])), [officialLangs]);

  React.useEffect(() => {
    if (clickedAddressTab === 'shipping_label' && clickedAddressDetails) {
      generateInternationalShippingLabel(clickedAddressDetails).then(setShippingLabel);
    }
  }, [clickedAddressTab, clickedAddressDetails]);

  // If current tab is not in display list (e.g. was 'local'), default to the first official lang
  React.useEffect(() => {
    if (!clickedAgid) return;
    if (clickedAddressTab === 'local' || !displayTabs.includes(clickedAddressTab)) {
      if (displayTabs.length > 0 && clickedAddressTab !== 'carrier' && clickedAddressTab !== 'intl_en' && clickedAddressTab !== 'shipping_label') {
        setClickedAddressTab(displayTabs[0]);
      }
    }
  }, [clickedAgid, clickedAddressTab, displayTabs, setClickedAddressTab]);

  if (!clickedAgid) return null;

  const getAddressDisplay = () => {
    if (clickedAddressTab === 'shipping_label') {
      return shippingLabel || "Generating shipping label...";
    }

    if (clickedAddressDetails) {
      const canonical = createCanonicalAddress(clickedAddressDetails);
      if (clickedAddressTab === 'intl_en') {
        return AddressRenderer.render('intl_en', canonical);
      }
      if (clickedAddressTab === 'carrier') {
        return AddressRenderer.renderCarrier(canonical);
      }
      return AddressRenderer.render(clickedAddressTab, canonical);
    }

    return clickedAddressMap[clickedAddressTab] || 
           (clickedAddressTab === 'en' ? (fastJapaneseTransliterate(clickedAddress) || "Translating...") : clickedAddress) || 
           "Resolving...";
  };

  const getTabLabel = (langCode: string) => {
    if (langCode === 'intl_en') return "English (Intl)";
    if (langCode === 'en') return "English";
    
    const lang = LANGUAGES.find(l => l.code === langCode);
    if (lang) return lang.name;
    
    switch (langCode) {
      case 'carrier': return t('tab_carrier');
      default: return langCode.toUpperCase();
    }
  };

  return (
    <motion.div 
      layout
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 20 }}
      className={cn(
        "bg-slate-900/90 backdrop-blur-xl shadow-2xl border pointer-events-auto text-white transition-all duration-500 overflow-hidden mx-auto",
        clickedAgid.id.startsWith('IN') ? "border-orange-500/30" : clickedAgid.id.startsWith('ZA') ? "border-green-500/30" : "border-slate-800",
        isAgidPanelCollapsed 
           ? "w-14 h-14 rounded-2xl flex items-center justify-center p-0 cursor-pointer hover:bg-slate-800 hover:scale-110 active:scale-95 shadow-red-500/20 shadow-lg" 
           : "w-full rounded-[2rem] p-4"
      )}
      onClick={isAgidPanelCollapsed ? () => setIsAgidPanelCollapsed(false) : undefined}
    >
      <div className={cn("flex flex-col gap-2 w-full h-full", isAgidPanelCollapsed && "items-center justify-center")}>
        {isAgidPanelCollapsed ? (
           <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center"
           >
               <div className="relative">
                <div className="w-4 h-4 bg-red-500 rounded-md shadow-[0_0_12px_rgba(239,68,68,0.7)]" />
                <div className={cn(
                  "absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full animate-pulse",
                  isAgidPinnedToGps ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                )} />
               </div>
           </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <div className="p-1.5 bg-red-500/10 rounded-lg">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-red-400/90 truncate max-w-[150px]">
                  {clickedAgid.isSea ? t('agid_code') : t('country_code')}
                </span>
                {isAgidPinnedToGps && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full animate-pulse">
                    <Target className="w-2 h-2 text-amber-500" />
                    <span className="text-[7px] font-black uppercase text-amber-500 tracking-tighter">GPS Locked</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsAgidPanelCollapsed(true); }}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white"
                  title="Collapse"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => {
                     e.stopPropagation();
                     setIsManualSelection(false);
                     if (mapRef.current) {
                       setClickedAgid(null);
                       setClickedAddress("");
                     }
                     setIsQrVisible(false);
                     setIsAgidPanelCollapsed(false);
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
               <div className="flex items-center justify-between gap-3 px-0.5">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <motion.div 
                    layoutId="agid-text"
                    className="font-black text-white tracking-widest font-mono truncate text-lg"
                  >
                    {clickedAgid.id}
                  </motion.div>
                  <button 
                    onClick={() => {
                       const addr = clickedAddressTab === 'translated' ? clickedAddressTranslated : clickedAddressMap[clickedAddressTab] || clickedAddress;
                       const fullText = `${clickedAgid.id}${addr ? ` (${addr})` : ''}`;
                       navigator.clipboard.writeText(fullText);
                       setCopied('agid');
                       setTimeout(() => setCopied(null), 2000);
                    }}
                    className="p-1 hover:bg-white/10 text-slate-400 rounded-lg transition-all active:scale-95"
                    title="Copy ID & Address"
                  >
                    {copied === 'agid' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                </div>
                
                <div className="flex items-center gap-0.5 font-mono">
                  <button 
                    onClick={() => {
                       if (mapRef.current && clickedAgid) {
                         mapRef.current.flyTo({
                           center: [(clickedAgid.bounds.minLon + clickedAgid.bounds.maxLon) / 2, (clickedAgid.bounds.minLat + clickedAgid.bounds.maxLat) / 2],
                           zoom: getDeviceZoom(),
                           pitch: mapPitch,
                           essential: true
                         });
                       }
                    }}
                    className="p-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-all"
                    title="Zoom to location"
                  >
                    <Maximize2 className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={(e) => {
                       e.stopPropagation();
                       const next = !isAgidPinnedToGps;
                       setIsAgidPinnedToGps(next);
                       if (next && userLocation) {
                         const result = encodeAGID(userLocation.lat, userLocation.lng);
                         setClickedAgid(result);
                         showAlert("AGID Locked", "Pinning current location...");
                         reverseGeocode(userLocation.lat, userLocation.lng, result.prefix, result.isSea, true);
                       } else if (!next) {
                         showAlert("AGID Unlocked", "Selection unlocked.");
                       }
                    }}
                    className={cn(
                       "p-1 rounded-lg transition-all border",
                       isAgidPinnedToGps 
                        ? "bg-amber-600/30 text-amber-400 border-amber-500/40 animate-pulse" 
                        : "bg-white/5 hover:bg-white/10 text-slate-400 border-white/5"
                    )}
                    title={isAgidPinnedToGps ? "Unlock AGID" : "Lock to GPS"}
                  >
                    <Key className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={() => setIsQrVisible(!isQrVisible)}
                    className={cn(
                       "p-1 rounded-lg transition-all border",
                       isQrVisible 
                        ? "bg-purple-600/30 text-purple-400 border-purple-500/40" 
                        : "bg-white/5 hover:bg-white/10 text-slate-400 border-white/5"
                    )}
                    title="Show QR Code"
                  >
                    <QrCode className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={() => {
                       const lat = (clickedAgid.bounds.minLat + clickedAgid.bounds.maxLat) / 2;
                       const lng = (clickedAgid.bounds.minLon + clickedAgid.bounds.maxLon) / 2;
                       const name = clickedAddress || clickedAgid.id;
                       setDestination({ lat, lng, name });
                       setDestinationQuery(name);
                       setIsRoutePlanning(true);
                       setIsNavigating(true);
                       if (userLocation) {
                         setOrigin({ ...userLocation, name: "My Location" });
                         setOriginQuery("My Location");
                       }
                    }}
                    className="p-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/30 active:scale-95"
                    title="Get Directions"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-tight">{t('get_directions')}</span>
                  </button>
                </div>
               </div>

               <motion.div 
                key="expanded-content"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
               >
                 {/* Territory Info */}
                 {clickedAgid.isSea && clickedAgid.regionName && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full w-fit">
                      <Waves className="w-2.5 h-2.5 text-blue-400" />
                      <span className="text-[9px] font-black text-blue-200">{clickedAgid.regionName}</span>
                    </div>
                 )}

                 {/* Address Area */}
                 <div className="group relative bg-white/5 rounded-2xl p-3 border border-white/10 hover:bg-white/[0.08] transition-colors">
                  <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                          {/* Intelligent Language Tabs */}
                          {displayTabs.map((langCode) => {
                            const isIntlEn = langCode === 'intl_en';
                            const isActive = clickedAddressTab === langCode;
                            
                            let label = getTabLabel(langCode);
                            let icon = isIntlEn ? <Globe className="w-2.5 h-2.5" /> : <MapPin className="w-2.5 h-2.5" />;
                            if (langCode === 'carrier') icon = <Truck className="w-2.5 h-2.5" />;

                            return (
                              <button
                                key={langCode}
                                onClick={() => {
                                  setClickedAddressTab(langCode);
                                }}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5",
                                  isActive
                                    ? "bg-white text-slate-900 shadow-lg"
                                    : "bg-white/5 text-slate-500 hover:bg-white/10"
                                )}
                              >
                                {icon}
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="text-[11px] font-medium text-slate-200 leading-snug min-h-[2.5em] space-y-2">
                         <div className={cn(
                           "p-2 rounded-lg border border-white/5 font-mono text-[10px] whitespace-pre-line leading-relaxed",
                           (clickedAddressTab === 'carrier' || clickedAddressTab === 'ascii' || clickedAddressTab === 'shipping_label') ? "bg-slate-800/80 uppercase" : "bg-white/5"
                         )}>
                           {getAddressDisplay()}
                         </div>
                      </div>

                     <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-white/5 overflow-x-auto no-scrollbar">
                        <button onClick={() => saveAgid(clickedAgid)} className="p-1.5 bg-white/5 rounded-lg text-slate-500" title="Save AGID"><Bookmark className="w-3 h-3" /></button>
                        <button onClick={() => setShowLocationAnalysis(!showLocationAnalysis)} className="p-1.5 bg-white/5 rounded-lg text-slate-500" title="Location Analysis"><Zap className="w-3 h-3" /></button>
                        <button onClick={() => setIsQrVisible(!isQrVisible)} className="p-1.5 bg-white/5 rounded-lg text-slate-500" title="QR Code"><QrCode className="w-3 h-3" /></button>
                     </div>
                  </div>
                 </div>

                 <AnimatePresence>
                  {isQrVisible && (
                     <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="bg-white rounded-[2rem] p-5 flex flex-col items-center gap-3 mt-3"
                     >
                        <div className="p-3 bg-slate-50 rounded-2xl shadow-inner">
                         <QRCodeCanvas value={clickedAgid.id} size={120} level="H" includeMargin={false} id="agid-qr-canvas" />
                        </div>
                        <button onClick={saveQrCode} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border border-slate-200">
                         <Download className="w-2.5 h-2.5" /> Save QR
                        </button>
                     </motion.div>
                  )}
                 </AnimatePresence>
               </motion.div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
