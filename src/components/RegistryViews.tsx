import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Search, 
  ArrowLeft, 
  ChevronRight, 
  Waves, 
  Globe 
} from 'lucide-react';

// --- Utility: Get major category for countries ---
const MAJOR_CATEGORIES = [
  { id: 'Asia', name: 'Asia', icon: Globe },
  { id: 'Europe', name: 'Europe', icon: Globe },
  { id: 'Africa', name: 'Africa', icon: Globe },
  { id: 'Americas', name: 'Americas', icon: Globe },
  { id: 'Oceania', name: 'Oceania', icon: Globe },
  { id: 'Antarctic', name: 'Antarctic', icon: Globe }
];

function getMajorCategory(item: any) {
  const area = item.area || '';
  if (area.includes('Asia')) return 'Asia';
  if (area.includes('Europe')) return 'Europe';
  if (area.includes('Africa')) return 'Africa';
  if (area.includes('America')) return 'Americas';
  if (area.includes('Oceania')) return 'Oceania';
  if (area.includes('Antarctic') || area.includes('South Pole')) return 'Antarctic';
  return 'Asia'; // Default
}

// --- Full Sea Registry View Component ---

export function FullSeaRegistryView({ registry, onClose, onSelect }: { registry: any[], onClose: () => void, onSelect: (item: any) => void }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<'all' | 'Named Sea' | 'Ocean Segment'>('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'prefix'>('prefix');

  const areas = useMemo(() => {
    const set = new Set<string>();
    registry.forEach(item => { if (item.area) set.add(item.area); });
    return Array.from(set).sort();
  }, [registry]);

  const filtered = useMemo(() => {
    return registry
      .filter(item => {
        const matchesSearch = item.id.toLowerCase().includes(search.toLowerCase()) || 
                             item.name.toLowerCase().includes(search.toLowerCase()) ||
                             item.prefix.toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === 'all' || item.type === typeFilter;
        const matchesArea = areaFilter === 'all' || item.area === areaFilter;
        return matchesSearch && matchesType && matchesArea;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'id') return a.id.localeCompare(b.id);
        return a.prefix.localeCompare(b.prefix);
      });
  }, [registry, search, typeFilter, areaFilter, sortBy]);

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 1 }}
      className="fixed inset-0 bg-slate-50 z-[1000] flex flex-col"
      style={{ 
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
    >
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 md:py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-none transition-colors text-slate-500 active:scale-90"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight line-clamp-1">IHO Sea Codes</h2>
            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
              Global Maritime • {filtered.length} Regions
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-none transition-colors text-slate-400 active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Filters Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by name, IHO code, or prefix..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-none py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            {['all', 'Named Sea', 'Ocean Segment'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type as any)}
                className={`whitespace-nowrap px-4 py-2 rounded-none text-[10px] font-black uppercase tracking-widest border transition-all ${
                  typeFilter === type 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {type === 'all' ? 'All Types' : type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Area:</span>
            <select 
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-none text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none min-w-[140px]"
            >
              <option value="all">All Oceans</option>
              {areas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
          <span className="uppercase tracking-widest shrink-0">Sort By:</span>
          <div className="flex items-center gap-1">
            {[
              { id: 'prefix', label: 'AGID Prefix' },
              { id: 'id', label: 'IHO Code' },
              { id: 'name', label: 'Name' }
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id as any)}
                className={`px-3 py-1.5 rounded-none border transition-all ${
                  sortBy === opt.id 
                    ? 'bg-slate-900 border-slate-900 text-white' 
                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Registry Grid */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item, idx) => (
            <button
              key={`${item.id}-${item.prefix}-${idx}`}
              onClick={() => onSelect(item)}
              className="group bg-white p-4 rounded-none border border-slate-200 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 transition-all text-left flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-none font-mono text-[11px] font-black border border-blue-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                    {item.prefix}
                  </span>
                  <span className="px-2.5 py-1 bg-slate-50 text-slate-500 rounded-none font-mono text-[11px] font-black border border-slate-100">
                    {item.id}
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-800 truncate leading-tight mb-1">{item.name}</h4>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                    item.type === 'Country' ? 'bg-blue-50 text-blue-600' :
                    item.type === 'Territory' ? 'bg-amber-50 text-amber-600' :
                    item.type === 'Autonomous' ? 'bg-emerald-50 text-emerald-600' :
                    item.type === 'Disputed' ? 'bg-red-50 text-red-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {item.type}
                  </span>
                  {item.area && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded uppercase tracking-tighter">
                      {item.area}
                    </span>
                  )}
                  <span className="text-[9px] font-bold text-slate-400 font-mono">
                    {item.lat.toFixed(1)}°, {item.lon.toFixed(1)}°
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <div className="text-slate-300 mb-4 flex justify-center"><Waves className="w-16 h-16" /></div>
            <h3 className="text-lg font-black text-slate-400">No results found for your search criteria</h3>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- Full Country Registry View Component ---

export function FullCountryRegistryView({ registry, onClose, onSelect }: { registry: any[], onClose: () => void, onSelect: (item: any) => void }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState('Asia');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');

  const filtered = useMemo(() => {
    return registry
      .filter(item => {
        const matchesSearch = item.id.toLowerCase().includes(search.toLowerCase()) || 
                             item.name.toLowerCase().includes(search.toLowerCase());
        const category = getMajorCategory(item as any);
        const matchesCategory = category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return a.id.localeCompare(b.id);
      });
  }, [registry, search, categoryFilter, sortBy]);

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 1 }}
      className="fixed inset-0 bg-slate-50 z-[1000] flex flex-col"
      style={{ 
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
    >
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 md:py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-none transition-colors text-slate-500 active:scale-90"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight line-clamp-1">ISO Registry</h2>
            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
              Country Codes • {filtered.length} Entities
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-none transition-colors text-slate-400 active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Navigation Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {MAJOR_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-none text-[10px] font-black uppercase tracking-widest border transition-all ${
                  categoryFilter === cat.id 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200 scale-105' 
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                }`}
              >
                <cat.icon className={`w-3 h-3 ${categoryFilter === cat.id ? 'text-white' : 'text-slate-300'}`} />
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input 
                type="text" 
                placeholder={`Search entities in ${categoryFilter}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-none py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-none border border-slate-200">
              {[
                { id: 'name', label: 'By Name' },
                { id: 'id', label: 'By Code' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id as any)}
                  className={`px-4 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest border transition-all ${
                    sortBy === opt.id 
                      ? 'bg-white border-slate-200 text-slate-900 shadow-sm' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Registry Grid */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filtered.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => onSelect(item)}
              className="group bg-white p-4 rounded-none border border-slate-200 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/5 transition-all text-left flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-none font-mono text-sm font-black border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all">
                    {item.id}
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-800 truncate leading-tight mb-1">{item.name}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-50 text-emerald-500 rounded uppercase tracking-tighter">
                    {item.area}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <div className="text-slate-300 mb-4 flex justify-center"><Globe className="w-16 h-16" /></div>
            <h3 className="text-lg font-black text-slate-400">No results found for your search criteria</h3>
          </div>
        )}
      </div>
    </motion.div>
  );
}
