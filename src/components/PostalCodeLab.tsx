import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Sparkles, ShieldAlert, Copy, RefreshCw, X, Check, Save, Brain, Info, Search, MapPin, Globe, ChevronLeft, ChevronRight, Users, BarChart3, Settings2, Zap, History, Menu, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { encodeAGID } from '../lib/agid';
import { getPatternForPrefix, applySmartPattern, PostalPattern, NO_POSTAL_COUNTRIES, POSTAL_PATTERNS } from '../lib/postalPatterns';

interface PostalCodeLabProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpTo: (lat: number, lng: number, zoom?: number) => void;
  onSelectCountry?: (countryCode: string) => void;
  currentAgid: string | null;
  currentAddress: string | null;
  lat: number;
  lng: number;
}

export const PostalCodeLab: React.FC<PostalCodeLabProps> = ({ 
  isOpen, 
  onClose,
  onJumpTo,
  onSelectCountry,
  currentAgid, 
  currentAddress,
  lat,
  lng
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<typeof NO_POSTAL_COUNTRIES[number] | null>(null);
  const [countryBoundary, setCountryBoundary] = useState<any>(null);
  const [countryStats, setCountryStats] = useState<{ population: number, area: number, region: string, subregion: string, capital: string } | null>(null);
  const [isLoadingBoundary, setIsLoadingBoundary] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [style, setStyle] = useState<'numeric' | 'alphanumeric' | 'hybrid' | 'smart'>('smart');
  const [customDigitCount, setCustomDigitCount] = useState<number>(5);
  const [isSaved, setIsSaved] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [isCustomizing, setIsCustomizing] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Local AGID state for the selected country preview
  const [previewAgid, setPreviewAgid] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');

  // Auto-select current country on mount
  useEffect(() => {
    if (isOpen && !selectedCountry && currentAgid) {
      const cc = currentAgid.split('-')[0];
      const match = NO_POSTAL_COUNTRIES.find(c => c.code === cc);
      if (match) {
        setSelectedCountry(match);
      }
    }
  }, [isOpen, currentAgid]);

  // Suggested digits calculation
  useEffect(() => {
    if (countryStats?.population) {
      // Suggest shortest digits based on population coverage (roughly 1 code per 150-200 people/units)
      const suggested = Math.ceil(Math.log10(countryStats.population / 150));
      setCustomDigitCount(Math.max(3, Math.min(8, suggested)));
    }
  }, [countryStats]);

  const filteredCountries = useMemo(() => {
    return NO_POSTAL_COUNTRIES.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.region.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const filteredCities = useMemo(() => {
    return cities.filter(city => 
      city.name?.toLowerCase().includes(citySearch.toLowerCase()) ||
      city.nameEn?.toLowerCase().includes(citySearch.toLowerCase())
    );
  }, [cities, citySearch]);

  // Fetch cities, boundary and stats when country is selected
  useEffect(() => {
    if (selectedCountry) {
      setIsLoadingCities(true);
      setIsLoadingBoundary(true);
      setIsLoadingStats(true);
      
      // Fetch cities
      fetch(`/api/country-cities?cc=${selectedCountry.code}`)
        .then(res => res.json())
        .then(data => {
          setCities(data || []);
          setIsLoadingCities(false);
        })
        .catch(err => {
          console.error("Failed to fetch cities:", err);
          setIsLoadingCities(false);
        });

      // Fetch boundary metadata
      fetch(`/api/country-boundary?cc=${selectedCountry.code}`)
        .then(res => res.json())
        .then(data => {
          setCountryBoundary(data);
          setIsLoadingBoundary(false);
        })
        .catch(err => {
          console.error("Failed to fetch boundary:", err);
          setIsLoadingBoundary(false);
        });

      // Fetch Stats
      fetch(`/api/country-stats?cc=${selectedCountry.code}`)
        .then(res => res.json())
        .then(data => {
          setCountryStats(data);
          setIsLoadingStats(false);
        })
        .catch(err => {
          console.error("Failed to fetch stats:", err);
          setIsLoadingStats(false);
        });
    } else {
      setCities([]);
      setCountryBoundary(null);
      setCountryStats(null);
    }
  }, [selectedCountry]);

  // Update preview when country or location changes
  useEffect(() => {
    const targetLat = selectedCountry ? selectedCountry.lat : lat;
    const targetLng = selectedCountry ? selectedCountry.lng : lng;
    const result = encodeAGID(targetLat, targetLng);
    setPreviewAgid(result.id);
  }, [selectedCountry, lat, lng]);

  useEffect(() => {
    if (previewAgid) {
      const pattern = getPatternForPrefix(previewAgid.split('-')[0]) || {
        country: 'Experimental',
        format: 'N'.repeat(customDigitCount),
        regex: /.*/,
        example: '1'.repeat(customDigitCount),
        description: 'Generic experimental format for no-postal regions.'
      };
      
      let code = '';
      if (style === 'smart') {
        // Adjust pattern format dynamically based on customDigitCount
        const adjustedPattern = { ...pattern, format: 'N'.repeat(customDigitCount) };
        code = applySmartPattern(previewAgid, adjustedPattern);
      } else if (style === 'numeric') {
        const hash = previewAgid.split('-')[1] || '0';
        code = `${previewAgid.split('-')[0]}-${parseInt(hash, 36).toString().slice(0, customDigitCount)}`;
      } else if (style === 'alphanumeric') {
        code = `${previewAgid.split('-')[0]}-${previewAgid.split('-')[1]?.slice(0, customDigitCount).toUpperCase()}`;
      } else {
        code = `${previewAgid.split('-')[0]}·${previewAgid.split('-')[1]?.slice(0, customDigitCount).toUpperCase()}·XP`;
      }
      setGeneratedCode(code);
      setIsSaved(false);
    }
  }, [previewAgid, style, customDigitCount]);

  const handleCountrySelect = (country: typeof NO_POSTAL_COUNTRIES[number]) => {
    setSelectedCountry(country);
    onJumpTo(country.lat, country.lng, 8);
    if (onSelectCountry) {
      onSelectCountry(country.code);
    }
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] pointer-events-none"
      >
        {/* Header */}
        <motion.div 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="absolute top-0 left-0 right-0 h-16 md:h-20 bg-white/95 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 md:px-8 pointer-events-auto shadow-sm"
        >
          <div className="flex items-center gap-3 md:gap-6">
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-base md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Postal Lab 
                <span className="text-[8px] md:text-[10px] bg-blue-600 text-white px-1.5 md:py-0.5 rounded-full uppercase tracking-widest font-black">Beta</span>
              </h2>
              <p className="text-[8px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                <Sparkles className="w-2 h-2 md:w-3 md:h-3" /> Experimental
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {selectedCountry && (
              <div className="flex items-center gap-2 md:gap-3 bg-slate-50 px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl border border-slate-100">
                <img 
                  src={`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`}
                  alt={selectedCountry.name}
                  className="w-4 md:w-5 h-auto rounded-sm shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-widest truncate max-w-[80px] md:max-w-none">
                  {selectedCountry.name}
                </span>
              </div>
            )}
            <div className="hidden md:block w-px h-8 bg-slate-100 mx-2" />
            <div className="hidden sm:flex bg-amber-50 border border-amber-100 px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl items-center gap-2 md:gap-3">
              <ShieldAlert className="w-3 h-3 md:w-4 md:h-4 text-amber-600 shrink-0" />
              <p className="text-[8px] md:text-[10px] text-amber-700 font-bold leading-relaxed hidden lg:block">
                Architecting postal protocols for non-indexed territories.
              </p>
            </div>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 bg-blue-50 text-blue-600 rounded-xl md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Sidebar (Left) */}
        <motion.div 
          initial={false}
          animate={{ x: isSidebarOpen ? 0 : -280 }}
          className="absolute top-16 md:top-20 left-0 bottom-0 w-72 bg-white/95 backdrop-blur-md border-r border-slate-100 flex flex-col pointer-events-auto shadow-2xl z-20"
        >
          {selectedCountry ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-5 rounded border border-slate-200 overflow-hidden shrink-0">
                    <img 
                      src={`https://flagcdn.com/w80/${selectedCountry.code.toLowerCase()}.png`}
                      alt={selectedCountry.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-xs font-black text-slate-800 tracking-tight truncate leading-none mb-0.5">{selectedCountry.name}</h3>
                    <div className="flex items-center gap-1.5 opacity-60">
                      <span className="text-[7px] font-black uppercase tracking-widest">{selectedCountry.code}</span>
                      <span className="text-[7px] font-bold uppercase tracking-widest truncate">{selectedCountry.region}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCountry(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {/* Territory Statistics */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-600">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Territory Statistics</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Pop</p>
                      <p className="text-xs font-black text-slate-900 tracking-tight">{countryStats?.population.toLocaleString() || '---'}</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Area</p>
                      <p className="text-xs font-black text-slate-900 tracking-tight">{countryStats?.area.toLocaleString() || '---'}</p>
                    </div>
                  </div>
                </div>

                {/* Protocol Architect */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-purple-600">
                    <Settings2 className="w-3.5 h-3.5" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Protocol Architect</h4>
                  </div>
                  <div className="bg-white border-2 border-slate-50 p-3 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-purple-600 font-mono">{customDigitCount}D</span>
                      <div className="flex items-center gap-1">
                        {(['smart', 'numeric', 'alphanumeric', 'hybrid'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setStyle(s)}
                            className={cn(
                              "w-5 h-5 rounded flex items-center justify-center text-[6px] font-black uppercase transition-all",
                              style === s ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                            )}
                            title={s}
                          >
                            {s[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input 
                      type="range"
                      min="3"
                      max="8"
                      step="1"
                      value={customDigitCount}
                      onChange={(e) => setCustomDigitCount(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                </div>

                {/* Synthesis Engine */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Zap className="w-3.5 h-3.5" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Synthesis Engine</h4>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 text-center space-y-2 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 to-purple-500" />
                    <p className="text-[6px] font-black text-white/30 uppercase tracking-[0.2em]">Output</p>
                    <div className="text-xl font-black text-white tracking-widest font-mono flex items-center justify-center gap-2">
                      {generatedCode}
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCode);
                          setIsSaved(true);
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setIsSaved(true);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-[9px] transition-all shadow-lg active:scale-95"
                  >
                    Deploy Architecture
                  </button>
                </div>

                {/* Local Context Brief */}
                <div className="space-y-2.5 pt-2 border-t border-slate-50">
                   <div className="flex flex-col p-2.5 bg-slate-50/50 rounded-lg text-left">
                      <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Local Context</span>
                      <p className="text-[9px] font-bold text-slate-500 line-clamp-2 leading-relaxed">
                        {selectedCountry.history || 'Systemic absence mapping... Architectural logic pending.'}
                      </p>
                   </div>
                </div>
              </div>
              
              <div className="mt-auto p-4 border-t border-slate-50 bg-slate-50/20 shrink-0">
                 <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5 tracking-widest">Locked Location</span>
                      <span className="font-mono text-[9px] font-black text-slate-600">{selectedCountry.lat.toFixed(4)}, {selectedCountry.lng.toFixed(4)}</span>
                    </div>
                    <MapPin className="w-3.5 h-3.5 text-blue-500 opacity-30" />
                 </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search territories..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => handleCountrySelect(country)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 border-b border-slate-50 transition-all text-left",
                      selectedCountry?.code === country.code ? "bg-blue-600 text-white shadow-lg" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-6 rounded overflow-hidden flex items-center justify-center font-black text-[10px] shrink-0 border border-slate-200",
                        selectedCountry?.code === country.code ? "bg-white/20 border-white/40 text-white" : "bg-slate-100 text-slate-400"
                      )}>
                        <img 
                          src={`https://flagcdn.com/w80/${country.code.toLowerCase()}.png`}
                          alt={country.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <p className={cn("text-xs font-black", selectedCountry?.code === country.code ? "text-white" : "text-slate-700")}>
                          {country.name}
                        </p>
                        <p className={cn("text-[9px] font-bold uppercase tracking-widest", selectedCountry?.code === country.code ? "text-white/60" : "text-slate-400")}>
                          {country.region}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {!selectedCountry && (
                <div className="p-8 text-center space-y-4">
                  <Globe className="w-12 h-12 text-slate-200 mx-auto" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                    Choose a country to begin land-based synthesis
                  </p>
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Minimal Bottom Info for feedback */}
        {selectedCountry && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="absolute bottom-4 left-4 md:left-76 right-4 pointer-events-none z-10"
          >
            <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-auto max-w-4xl mx-auto">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">Protocol Synthesis Active</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Real-time data synchronization across all sectors</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Current Prefix</span>
                    <span className="text-lg font-black text-slate-900 font-mono tracking-widest">{generatedCode}</span>
                 </div>
                 <div className="w-px h-10 bg-slate-100 mx-2 hidden md:block" />
                 <button 
                  onClick={() => onClose()}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                 >
                   Exit Lab
                 </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Floating Metadata (Top Right) */}
        {selectedCountry && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-20 md:top-24 right-4 md:right-8 w-64 space-y-4 pointer-events-auto hidden md:block" // Hidden on mobile to avoid overlap
          >
             <div className="bg-white/90 backdrop-blur rounded-[2rem] p-6 border border-slate-100 shadow-xl space-y-4">
                <div className="flex items-center gap-3 text-purple-600">
                  <Globe className="w-4 h-4" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Territory Analysis</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Capital</span>
                    <span className="text-xs font-black text-slate-700">{countryStats?.capital || '---'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Geometry</span>
                    <span className="text-xs font-black text-slate-700">{countryBoundary?.type || '---'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Points</span>
                    <span className="text-xs font-black text-slate-700">{cities.length > 50 ? 'High Density' : 'Low Density'}</span>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl">
                  <p className="text-[8px] font-bold text-purple-600/70 italic leading-relaxed">
                    National boundary synchronization complete. Spatial indexing mapping to 512-byte sectors.
                  </p>
                </div>
             </div>

             <div className="bg-slate-900 rounded-[2rem] p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-amber-400">
                  <History className="w-4 h-4" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Postal Archeology</h4>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-white leading-relaxed">
                    {selectedCountry.history || 
                     (currentAgid && POSTAL_PATTERNS[currentAgid.split('-')[0]]?.history) || 
                     'Systemic absence mapping... Architectural logic pending further research.'}
                  </p>
                  <div className="flex items-center gap-2 pt-2 grayscale opacity-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Context Synchronized</span>
                  </div>
                </div>
             </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
