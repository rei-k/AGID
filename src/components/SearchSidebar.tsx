
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  ArrowLeft, 
  Search, 
  QrCode, 
  X, 
  MapPin, 
  ArrowUpRight, 
  History, 
  Clock, 
  Sparkles, 
  Flag, 
  Navigation, 
  MountainSnow, 
  ChevronRight, 
  Camera, 
  Upload, 
  ExternalLink, 
  Truck, 
  User, 
  Zap, 
  LocateFixed,
  Globe 
} from 'lucide-react';
import { cn } from '../lib/utils';
import maplibregl from 'maplibre-gl';

interface SearchSidebarProps {
  t: (key: string) => string;
  isSearchFocused: boolean;
  setIsSearchFocused: (f: boolean) => void;
  isRoutePlanning: boolean;
  setIsRoutePlanning: (p: boolean) => void;
  isGuidanceActive: boolean;
  setIsGuidanceActive: (a: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: any[];
  setSearchResults: (r: any[]) => void;
  isSearching: boolean;
  searchHistory: string[];
  clearHistory: () => void;
  removeFromHistory: (q: string) => void;
  performSearch: (q: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  selectSearchResult: (r: any) => void;
  getCurrentMapCenter: () => { lat: number, lng: number } | null;
  showCoordinateSearch: boolean;
  setShowCoordinateSearch: (s: boolean) => void;
  startQrScanner: () => void;
  setShowMenu: (s: boolean) => void;
  qrFileRef: React.RefObject<HTMLInputElement>;
  handleQrFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleTracking: () => void;
  isTracking: boolean;
  isLocating: boolean;
  userLocation: any;
  destination: any;
  setDestination: (d: any) => void;
  destinationQuery: string;
  setDestinationQuery: (q: string) => void;
  origin: any;
  setOrigin: (o: any) => void;
  originQuery: string;
  setOriginQuery: (q: string) => void;
  routeData: any;
  setRouteData: (d: any) => void;
  isNavigating: boolean;
  setIsNavigating: (n: boolean) => void;
  routingMode: 'driving' | 'walking';
  setRoutingMode: (m: 'driving' | 'walking') => void;
  useBidirectionalDijkstra: boolean;
  setUseBidirectionalDijkstra: (v: boolean) => void;
  isRoutingLoading: boolean;
  openExternalMap: (app: string) => void;
  defaultNavApp: string;
  originResults: any[];
  destinationResults: any[];
  selectOrigin: (f: any) => void;
  selectDestination: (f: any) => void;
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
}

export const SearchSidebar: React.FC<SearchSidebarProps> = ({
  isSearchFocused,
  setIsSearchFocused,
  t,
  isRoutePlanning,
  setIsRoutePlanning,
  isGuidanceActive,
  setIsGuidanceActive,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  isSearching,
  searchHistory,
  clearHistory,
  removeFromHistory,
  performSearch,
  handleSearch,
  selectSearchResult,
  getCurrentMapCenter,
  showCoordinateSearch,
  setShowCoordinateSearch,
  startQrScanner,
  setShowMenu,
  qrFileRef,
  handleQrFileUpload,
  toggleTracking,
  isTracking,
  isLocating,
  userLocation,
  destination,
  setDestination,
  destinationQuery,
  setDestinationQuery,
  origin,
  setOrigin,
  originQuery,
  setOriginQuery,
  routeData,
  setRouteData,
  isNavigating,
  setIsNavigating,
  routingMode,
  setRoutingMode,
  useBidirectionalDijkstra,
  setUseBidirectionalDijkstra,
  isRoutingLoading,
  openExternalMap,
  defaultNavApp,
  originResults,
  destinationResults,
  selectOrigin,
  selectDestination,
  mapRef
}) => {
  const [coordLat, setCoordLat] = useState("");
  const [coordLng, setCoordLng] = useState("");

  const handleCoordinateJump = () => {
    const lat = parseFloat(coordLat);
    const lng = parseFloat(coordLng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      performSearch(`${lat}, ${lng}`);
    } else {
      alert(t('invalid_coords'));
    }
  };

  const loadCurrentCoords = () => {
    const center = getCurrentMapCenter();
    if (center) {
      setCoordLat(center.lat.toFixed(6));
      setCoordLng(center.lng.toFixed(6));
    }
  };

  return (
    <div className={cn(
      "absolute z-40 transition-all duration-300 pointer-events-none flex flex-col gap-3",
      isSearchFocused ? "inset-0 w-full h-full md:inset-auto md:top-6 md:left-3 md:w-[440px] md:h-[calc(100vh-48px)] p-0 md:p-0" : "top-2 left-3 right-3 md:top-6 md:left-3 md:w-[440px] md:h-auto p-0",
      "max-w-md"
    )}>
      <AnimatePresence mode="wait">
        {!isRoutePlanning || isGuidanceActive ? (
          <motion.div 
            key="search-box"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "bg-white shadow-xl border-slate-200 pointer-events-auto flex flex-col transition-all duration-300 ease-in-out max-h-full overflow-hidden",
              isSearchFocused ? "h-full rounded-2xl md:rounded-3xl shadow-xl" : "h-[48px] md:h-[56px] rounded-2xl md:rounded-3xl shadow-md border"
            )}
          >
            {/* Search Bar Header */}
            <div className="flex items-center p-1 md:p-1.5 gap-0.5 md:gap-1.5 shrink-0">
              <button 
                onClick={() => {
                  if (isSearchFocused) {
                    setIsSearchFocused(false);
                    setSearchResults([]);
                  } else {
                    setShowMenu(true);
                  }
                }}
                className="p-2 md:p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
              >
                {isSearchFocused ? (
                  <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                ) : (
                  <Menu className="w-5 h-5 md:w-6 md:h-6" />
                )}
              </button>
              
              <form onSubmit={handleSearch} className="flex-1 flex items-center pr-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    setIsSearchFocused(true);
                    setShowCoordinateSearch(false);
                  }}
                  placeholder={t('search_here')}
                  className="flex-1 bg-transparent px-2 md:px-3 py-2 md:py-2.5 focus:outline-none text-slate-800 placeholder-slate-400 font-medium text-sm md:text-base min-w-0"
                />

                <div className="flex items-center shrink-0 ml-1">
                  <button
                    type="button"
                    onClick={startQrScanner}
                    className="p-1.5 md:p-2 text-slate-400 hover:text-blue-500 transition-colors"
                    title="Camera Scan"
                  >
                    <Camera className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => qrFileRef.current?.click()}
                    className="p-1.5 md:p-2 text-slate-400 hover:text-purple-500 transition-colors"
                    title="Upload QR"
                  >
                    <QrCode className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        if (!searchResults.length) setIsSearchFocused(false);
                      }}
                      className="p-1.5 md:p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  <button 
                    type="submit"
                    disabled={isSearching}
                    className="ml-1 px-2.5 md:px-3 py-1.5 md:py-2 bg-blue-600 text-white rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1.5 min-w-[36px] md:min-w-[80px]"
                  >
                    {isSearching ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{t('search_button')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Collapsible Search Content */}
            <AnimatePresence>
              {(isSearchFocused || searchResults.length > 0) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-col flex-1 overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-slate-50">
                    {/* Coordinate Search (Advanced) */}
                    {(searchResults.length === 0 || showCoordinateSearch) && (
                      <div className={cn(
                        "flex flex-col border-b border-slate-50 last:border-0 transition-all duration-500",
                        showCoordinateSearch && "bg-blue-50/10 ring-2 ring-blue-500/5"
                      )}>
                        <div className="px-5 py-3 bg-slate-50/40 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-blue-100/50 rounded-lg">
                              <Globe className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('advanced_search')}</span>
                          </div>
                          <button 
                            onClick={loadCurrentCoords}
                            className="px-2 py-1 bg-white hover:bg-slate-50 text-[8px] font-black uppercase tracking-tighter text-slate-500 border border-slate-100 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1"
                          >
                            <LocateFixed className="w-2.5 h-2.5" />
                            {t('current_coords')}
                          </button>
                        </div>
                        <div className="px-5 pb-4 pt-1 flex flex-col gap-3">
                          <div className="flex gap-2">
                            <div className="flex-1 flex flex-col gap-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('latitude')}</label>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  value={coordLat}
                                  onChange={(e) => setCoordLat(e.target.value)}
                                  placeholder="35.6812"
                                  step="any"
                                  className="w-full bg-white px-3 py-2.5 rounded-xl text-sm font-bold border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                                />
                              </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('longitude')}</label>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  value={coordLng}
                                  onChange={(e) => setCoordLng(e.target.value)}
                                  placeholder="139.7671"
                                  step="any"
                                  className="w-full bg-white px-3 py-2.5 rounded-xl text-sm font-bold border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                                />
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={handleCoordinateJump}
                            disabled={!coordLat || !coordLng}
                            className={cn(
                              "w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100",
                              coordLat && coordLng 
                                ? "bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]" 
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                          >
                            <ArrowUpRight className="w-4 h-4" />
                            {t('jump_to_map')}
                          </button>
                          <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-tight opacity-70">
                            {t('search_coords_hint')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="flex flex-col">
                        <div className="px-5 py-3 bg-slate-50/40 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('search_results')}</span>
                          <span className="text-[10px] font-bold text-blue-500">{t('results_found').replace('{{count}}', String(searchResults.length))}</span>
                        </div>
                        {searchResults.map((result, idx) => (
                          <div key={idx} className="flex items-center hover:bg-blue-50/50 transition-all border-b border-slate-50 last:border-0 group">
                            <button
                              type="button"
                              onClick={() => selectSearchResult(result)}
                              className="flex-1 px-5 py-3 text-left flex flex-col gap-1"
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "p-2 rounded-xl transition-all shadow-sm",
                                  result.type === 'saved_qr' ? "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white" : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                                )}>
                                  {result.type === 'saved_qr' ? <QrCode className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-bold text-slate-800 truncate">
                                    {result.display_name.split(',')[0]}
                                  </span>
                                  <span className="text-[10px] text-slate-400 truncate leading-tight">
                                    {result.display_name.split(',').slice(1).join(',').trim() || (result.type === 'saved_qr' ? t('saved_qr') : result.type)}
                                  </span>
                                </div>
                                {result.source === 'local_db' && (
                                  <span className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-1.5 rounded-lg uppercase tracking-tighter shrink-0">Native</span>
                                )}
                                {result.source === 'local_qrs' && (
                                  <span className="text-[8px] font-black bg-purple-100 text-purple-600 px-1.5 rounded-lg uppercase tracking-tighter shrink-0">Saved</span>
                                )}
                              </div>
                            </button>
                            <div className="flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const lat = parseFloat(result.lat);
                                  const lng = parseFloat(result.lon);
                                  const name = result.display_name.split(',')[0];
                                  
                                  setDestination({ lat, lng, name });
                                  setDestinationQuery(name);
                                  setIsRoutePlanning(true);
                                  setIsNavigating(true);
                                  setSearchResults([]);
                                  setIsSearchFocused(false);
                                  
                                  if (userLocation) {
                                    setOrigin({ lat: userLocation.lat, lng: userLocation.lng, name: t('my_location') });
                                    setOriginQuery(t('my_location'));
                                  }
                                }}
                                className="p-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-200 flex items-center gap-2"
                                title={t('get_directions')}
                              >
                                <ArrowUpRight className="w-5 h-5" />
                                <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">{t('route')}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* History */}
                    {searchHistory.length > 0 && (
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between px-5 py-2 bg-white">
                          <div className="flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('recent_activity')}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              clearHistory();
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors px-2 py-0.5 rounded-lg hover:bg-red-50"
                          >
                            {t('clear')}
                          </button>
                        </div>
                        {searchHistory.map((query, idx) => (
                          <div key={idx} className="flex items-center hover:bg-slate-50 transition-colors group/history px-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery(query);
                                performSearch(query);
                              }}
                              className="flex-1 px-3 py-1.5 text-left flex items-center gap-3"
                            >
                              <div className="p-1 bg-slate-100 rounded-lg text-slate-400 group-hover/history:bg-blue-100 group-hover/history:text-blue-600 transition-all">
                                <Clock className="w-3 h-3" />
                              </div>
                              <span className="text-sm font-medium text-slate-600 truncate">{query}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeFromHistory(query);
                              }}
                              className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/history:opacity-100 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Discover */}
                    {searchResults.length === 0 && searchHistory.length === 0 && (
                      <div className="flex flex-col">
                        <div className="px-5 py-4 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('explore_nearby')}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1 px-3 pb-4">
                          {[
                            { name: "Tokyo, Japan", icon: <Flag className="w-4 h-4" />, color: "bg-red-50 text-red-600" },
                            { name: "New York City", icon: <Navigation className="w-4 h-4" />, color: "bg-blue-50 text-blue-600" },
                            { name: "London, UK", icon: <Flag className="w-4 h-4" />, color: "bg-indigo-50 text-indigo-600" },
                            { name: "Paris, France", icon: <Flag className="w-4 h-4" />, color: "bg-blue-100 text-blue-800" },
                            { name: "Mount Everest", icon: <MountainSnow className="w-4 h-4" />, color: "bg-emerald-50 text-emerald-600" }
                          ].map((place, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSearchQuery(place.name);
                                performSearch(place.name);
                              }}
                              className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-all rounded-2xl group border border-transparent hover:border-slate-100"
                            >
                              <div className={cn("p-2.5 rounded-xl transition-all shadow-sm group-hover:scale-110", place.color)}>
                                {place.icon}
                              </div>
                              <div className="flex flex-col items-start">
                                <span className="text-sm font-bold text-slate-700">{place.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{t('quick_discovery')}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 ml-auto text-slate-200 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Utility shortcuts */}
            {!(isSearchFocused || searchResults.length > 0) && (
              <div className="flex items-center gap-0.5 ml-auto pr-1.5 shrink-0">
                <button 
                  type="button"
                  onClick={() => {
                    setIsRoutePlanning(true);
                    if (!destination && userLocation) {
                      setOrigin({ ...userLocation, name: t('my_location') });
                      setOriginQuery(t('my_location'));
                    }
                  }}
                  className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl transition-all active:scale-95"
                  title={t('directions')}
                >
                  <ArrowUpRight className="w-5 h-5" />
                </button>

                <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                
                <button 
                  type="button"
                  onClick={toggleTracking}
                  className={cn(
                    "p-2.5 transition-all rounded-xl active:scale-95 relative group",
                    isTracking ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:bg-slate-50 hover:text-blue-600"
                  )}
                  title={isTracking ? t('stop_tracking') : t('use_my_location')}
                >
                  <Navigation className={cn("w-5 h-5", (isLocating || isTracking) && "animate-pulse text-blue-600")} />
                </button>
              </div>
            )}

            <input 
              type="file" 
              ref={qrFileRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleQrFileUpload}
            />
          </motion.div>
        ) : (
          <motion.div 
            key="route-panel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-slate-200 pointer-events-auto p-4 flex flex-col gap-4 w-full"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Navigation className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('routing')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => openExternalMap(defaultNavApp)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('navigation')}
                </button>
                <button 
                  onClick={() => {
                    setIsRoutePlanning(false);
                    setIsNavigating(false);
                    setRouteData(null);
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              {/* Visual Connector */}
              <div className="flex flex-col items-center py-2 gap-1 translate-y-3">
                <div className="w-3 h-3 rounded-full border-2 border-slate-300 bg-white" />
                <div className="w-0.5 flex-1 border-l-2 border-dotted border-slate-300" />
                <div className="w-3 h-3 rounded-full bg-blue-600" />
              </div>

              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between mb-2 gap-4 overflow-x-auto pb-1 scrollbar-hide">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0">
                    <button 
                      onClick={() => setRoutingMode('driving')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all",
                        routingMode === 'driving' ? "bg-white text-blue-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-700 font-bold"
                      )}
                    >
                      <Truck className="w-3 h-3" />
                      <span className="text-[10px] uppercase tracking-widest">{t('car')}</span>
                    </button>
                    <button 
                      onClick={() => setRoutingMode('walking')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all",
                        routingMode === 'walking' ? "bg-white text-blue-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-700 font-bold"
                      )}
                    >
                      <User className="w-3 h-3" />
                      <span className="text-[10px] uppercase tracking-widest">{t('walk')}</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => setUseBidirectionalDijkstra(!useBidirectionalDijkstra)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all border shrink-0 ml-auto",
                      useBidirectionalDijkstra 
                        ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm" 
                        : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    <Zap className={cn("w-3.5 h-3.5", useBidirectionalDijkstra && "fill-current text-blue-500")} />
                    <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                      {useBidirectionalDijkstra ? t('bd_on') : t('advanced')}
                    </span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={originQuery}
                    onChange={(e) => setOriginQuery(e.target.value)}
                    placeholder={t('starting_point')}
                    className="w-full bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-10"
                  />
                  {originQuery && (
                    <button 
                      onClick={() => { setOriginQuery(""); setOrigin(null); }}
                      className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                       if (userLocation) {
                         setOrigin({ ...userLocation, name: t('my_location') });
                         setOriginQuery(t('my_location'));
                       }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600"
                  >
                    <LocateFixed className="w-4 h-4" />
                  </button>
                  
                  {/* Origin Results */}
                  <AnimatePresence>
                    {originResults.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[60]"
                      >
                        {originResults.map((f, i) => (
                          <button key={i} onClick={() => selectOrigin(f)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0">
                            <span className="font-bold block truncate">{f.properties.name}</span>
                            <span className="text-slate-400 truncate block">{f.properties.city}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={destinationQuery}
                    onChange={(e) => setDestinationQuery(e.target.value)}
                    placeholder={t('destination')}
                    className="w-full bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-10"
                  />
                  {destinationQuery && (
                    <button 
                      onClick={() => { setDestinationQuery(""); setDestination(null); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  
                  {/* Destination Results */}
                  <AnimatePresence>
                    {destinationResults.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[60]"
                      >
                        {destinationResults.map((f, i) => (
                          <button key={i} onClick={() => selectDestination(f)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0">
                            <span className="font-bold block truncate">{f.properties.name}</span>
                            <span className="text-slate-400 truncate block">{f.properties.city}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-1">
              <button 
                onClick={() => {
                  const start = origin || userLocation;
                  if (start && destination) {
                    setIsNavigating(true);
                    if (mapRef.current) {
                      const bounds = new maplibregl.LngLatBounds()
                        .extend([start.lng, start.lat])
                        .extend([destination.lng, destination.lat]);
                      mapRef.current.fitBounds(bounds, { padding: 100 });
                    }
                  }
                }}
                disabled={!(origin || userLocation) || !destination}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-200 active:scale-95"
              >
                {routeData ? t('update_route') : t('show_route')}
              </button>
              {routeData && (
                <button 
                  onClick={() => setIsGuidanceActive(true)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 active:scale-95"
                >
                  {t('start_guidance')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
