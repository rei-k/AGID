
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Map as MapIcon, 
  Users, 
  Hash, 
  Layout, 
  Sparkles, 
  Check, 
  X, 
  Info,
  Maximize2,
  Minimize2,
  ChevronRight,
  Loader2,
  Zap
} from 'lucide-react';
import { proposeAddressingScheme, AddressingProposal } from '../services/AddressDesignAI';
import { cn } from '../lib/utils';

interface GeoArchitectPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRegion: (geojson: any) => void;
  onDeploy?: (config: { postcodeDigits: number; hierarchy: string[]; country: string }) => void;
  currentCountry?: string;
  currentRegion?: string;
}

export const GeoArchitectPanel: React.FC<GeoArchitectPanelProps> = ({ 
  isOpen, 
  onClose, 
  onSelectRegion,
  onDeploy,
  currentCountry = 'Japan',
  currentRegion
}) => {
  const [proposal, setProposal] = useState<AddressingProposal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customDigitCount, setCustomDigitCount] = useState<number>(5);
  const [selectedHierarchy, setSelectedHierarchy] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      handleGetProposal();
    }
  }, [isOpen]);

  const handleGetProposal = async () => {
    setIsLoading(true);
    try {
      const result = await proposeAddressingScheme(currentCountry, currentRegion);
      setProposal(result);
      setSelectedHierarchy(result.hierarchyLevels);
      
      // Extract digit count from NNNN format
      const match = result.suggestedPostcodeFormat.match(/N+/g);
      if (match) {
        setCustomDigitCount(match[0].length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyHighlight = async (target: string) => {
    try {
      // Nominatim search for specific local region via Proxy
      const query = target.includes(currentCountry) ? target : `${target}, ${currentCountry}`;
      const res = await fetch(`/api/osm-search?q=${encodeURIComponent(query)}&limit=1&polygon_geojson=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const first = data[0];
          // Valid GeoJSON can come from Nominatim if polygon_geojson=1 is used
          if (first.geojson) {
             onSelectRegion(first.geojson);
          } else {
             // Fallback to coordinates if no polygon
             onSelectRegion({
               type: 'Point',
               coordinates: [parseFloat(first.lon), parseFloat(first.lat)]
             });
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch boundary:", e);
    }
  };

  const hierarchyOptions = [
    { id: 'Nation', icon: Globe, color: 'text-blue-500' },
    { id: 'Island', icon: MapIcon, color: 'text-emerald-500' },
    { id: 'Prefecture/State', icon: Layout, color: 'text-purple-500' },
    { id: 'City', icon: Layout, color: 'text-amber-500' },
    { id: 'Ward/Municipality', icon: Layout, color: 'text-rose-500' },
    { id: 'District/Town', icon: Layout, color: 'text-indigo-500' },
    { id: 'Chome/Block', icon: Hash, color: 'text-slate-500' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80]"
          />
          <motion.div 
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-4 bottom-4 top-20 bg-white rounded-3xl shadow-2xl z-[90] overflow-hidden flex flex-col border border-slate-200 lg:left-auto lg:right-4 lg:w-[480px] lg:top-4"
          >
            {/* Header */}
            <div className="p-6 bg-purple-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">Geo Architect AI</h2>
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Region Customizer & Design Lab</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse italic">Gemini is analyzing geographical patterns...</p>
                </div>
              ) : proposal && (
                <>
                  {/* Proposal Summary */}
                  <div className="bg-purple-50 rounded-2xl border border-purple-100 p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <h3 className="text-xs font-black text-purple-900 uppercase tracking-widest">AI Strategy Proposal</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Scale Type</label>
                        <p className="text-sm font-black text-slate-700">{proposal.scaleMetric}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Est. Population</label>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-sm font-black">{proposal.estimatedPopulation}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-purple-100 italic text-[10px] leading-relaxed text-slate-500">
                       <span className="font-bold text-purple-400 not-italic mr-1">AI INSIGHT:</span>
                       "{proposal.justification}"
                     </div>
                  </div>

                  {/* Hierarchy Customizer */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Layout className="w-3.5 h-3.5 text-blue-500" />
                        Hierarchy Selection
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {hierarchyOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSelectedHierarchy(prev => 
                              prev.includes(opt.id) ? prev.filter(l => l !== opt.id) : [...prev, opt.id]
                            );
                            handleApplyHighlight(opt.id + " in " + currentCountry);
                          }}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2",
                            selectedHierarchy.includes(opt.id) 
                              ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100" 
                              : "bg-white border-slate-200 text-slate-400 hover:border-blue-200 hover:text-blue-500"
                          )}
                        >
                          <opt.icon className={cn("w-3 h-3", selectedHierarchy.includes(opt.id) ? "text-white" : opt.color)} />
                          {opt.id}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Postcode Lab */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-emerald-500" />
                      Postcode Protocol Designer
                    </h3>
                    
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digit Complexity ({customDigitCount} chars)</label>
                        <input 
                          type="range"
                          min="3"
                          max="10"
                          value={customDigitCount}
                          onChange={(e) => setCustomDigitCount(parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Suggested Types</p>
                        {proposal.postcodeTypes.map(type => (
                          <div key={type} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                             <div className="flex items-center gap-3">
                               <div className="bg-emerald-50 p-1.5 rounded-lg">
                                 <Zap className="w-3.5 h-3.5 text-emerald-600" />
                               </div>
                               <span className="text-xs font-bold text-slate-700">{type}</span>
                             </div>
                             <div className="text-[10px] font-mono font-black text-blue-600">
                               {Array(customDigitCount).fill('N').join('')}
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Draft Only
              </button>
              <button 
                onClick={() => {
                  if (onDeploy) {
                    onDeploy({
                      postcodeDigits: customDigitCount,
                      hierarchy: selectedHierarchy,
                      country: currentCountry
                    });
                  }
                  onClose();
                }}
                className="flex-[2] py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-purple-100 flex items-center justify-center gap-2"
              >
                Deploy Configuration
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
