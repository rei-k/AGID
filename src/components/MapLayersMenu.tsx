
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Layers, 
  Check, 
  BarChart3, 
  Landmark, 
  Anchor, 
  Waves, 
  AlertOctagon, 
  MountainSnow, 
  Globe, 
  Map as MapIcon, 
  Grid3X3 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { MAP_STYLES } from '../constants/appConstants';
import maplibregl from 'maplibre-gl';

interface MapLayersMenuProps {
  show: boolean;
  onClose: () => void;
  mapStyle: string;
  changeStyle: (style: string) => void;
  mapPitch: number;
  setMapPitch: (p: number) => void;
  isSystematicMode: boolean;
  setIsSystematicMode: (m: boolean) => void;
  isRegionalMode: boolean;
  setIsRegionalMode: (m: boolean) => void;
  isNauticalMode: boolean;
  setIsNauticalMode: (m: boolean) => void;
  isSeaTypeMode: boolean;
  setIsSeaTypeMode: (m: boolean) => void;
  is3DEnabled: boolean;
  setIs3DEnabled: (m: boolean) => void;
  isDisasterMode: boolean;
  setIsDisasterMode: (m: boolean) => void;
  isMountainMode: boolean;
  setIsMountainMode: (m: boolean) => void;
  projection: 'globe' | 'mercator';
  setProjection: (p: 'globe' | 'mercator') => void;
  isGridVisible: boolean;
  setIsGridVisible: (v: boolean) => void;
  gridOpacityLevel: number;
  setGridOpacityLevel: (l: number) => void;
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
}

export const MapLayersMenu: React.FC<MapLayersMenuProps> = ({
  show,
  onClose,
  mapStyle,
  changeStyle,
  mapPitch,
  setMapPitch,
  isSystematicMode,
  setIsSystematicMode,
  isRegionalMode,
  setIsRegionalMode,
  isNauticalMode,
  setIsNauticalMode,
  isSeaTypeMode,
  setIsSeaTypeMode,
  is3DEnabled,
  setIs3DEnabled,
  isDisasterMode,
  setIsDisasterMode,
  isMountainMode,
  setIsMountainMode,
  projection,
  setProjection,
  isGridVisible,
  setIsGridVisible,
  gridOpacityLevel,
  setGridOpacityLevel,
  mapRef
}) => {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] pointer-events-auto"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] shadow-2xl z-[101] pointer-events-auto overflow-hidden"
          >
            <div className="max-w-4xl mx-auto p-4 md:p-6 pb-12">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Layers className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Map Layers</h3>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Map Type (地図の種類)</h4>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
                    {MAP_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => changeStyle(style.url)}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0 snap-start"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all overflow-hidden relative shadow-sm",
                          mapStyle === style.url ? "border-blue-500 ring-4 ring-blue-500/10 scale-105" : "border-slate-100 group-hover/item:border-blue-200"
                        )}>
                          <img 
                            src={style.thumb} 
                            alt={style.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {mapStyle === style.url && (
                            <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                              <Check className="w-3 h-3 text-blue-500" />
                            </div>
                          )}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center", mapStyle === style.url ? "text-blue-600" : "text-slate-500")}>
                          {style.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section>
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Map Tilt (傾き: {mapPitch}°)</h4>
                    <div className="px-1 py-2">
                      <input 
                        type="range" 
                        min="0" 
                        max="85" 
                        step="5"
                        value={mapPitch} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setMapPitch(val);
                          if (mapRef.current) mapRef.current.setPitch(val);
                        }}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between mt-1 px-0.5">
                        <span className="text-[7px] font-bold text-slate-400">Flat (平坦)</span>
                        <span className="text-[7px] font-bold text-slate-400">Low (低)</span>
                        <span className="text-[7px] font-bold text-slate-400">Medium (中)</span>
                        <span className="text-[7px] font-bold text-slate-400">High (高)</span>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Geography (地理学)</h4>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
                      <button
                        onClick={() => setIsSystematicMode(!isSystematicMode)}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0 snap-start w-12 md:w-14"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center relative shadow-sm",
                          isSystematicMode ? "border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-500/10" : "border-slate-100 bg-slate-50 text-slate-400 group-hover/item:border-blue-200"
                        )}>
                          <BarChart3 className="w-5 h-5" />
                          {isSystematicMode && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", isSystematicMode ? "text-blue-600" : "text-slate-500")}>
                          Systematic
                        </span>
                      </button>

                      <button
                        onClick={() => setIsRegionalMode(!isRegionalMode)}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0 snap-start w-12 md:w-14"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center relative shadow-sm",
                          isRegionalMode ? "border-emerald-500 bg-emerald-50 text-emerald-600 ring-4 ring-emerald-500/10" : "border-slate-100 bg-slate-50 text-slate-400 group-hover/item:border-emerald-200"
                        )}>
                          <Landmark className="w-5 h-5" />
                          {isRegionalMode && <div className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full border border-white" />}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", isRegionalMode ? "text-emerald-600" : "text-slate-500")}>
                          Regional
                        </span>
                      </button>

                      <button
                        onClick={() => setIsNauticalMode(!isNauticalMode)}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0 snap-start w-12 md:w-14"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center relative shadow-sm",
                          isNauticalMode ? "border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-500/10" : "border-slate-100 bg-slate-50 text-slate-400 group-hover/item:border-blue-200"
                        )}>
                          <Anchor className="w-5 h-5" />
                          {isNauticalMode && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", isNauticalMode ? "text-blue-600" : "text-slate-500")}>
                          Nautical
                        </span>
                      </button>

                      <button
                        onClick={() => setIsSeaTypeMode(!isSeaTypeMode)}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0 snap-start w-12 md:w-14"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center relative shadow-sm",
                          isSeaTypeMode ? "border-cyan-500 bg-cyan-50 text-cyan-600 ring-4 ring-cyan-500/10" : "border-slate-100 bg-slate-50 text-slate-400 group-hover/item:border-cyan-200"
                        )}>
                          <Waves className="w-5 h-5" />
                          {isSeaTypeMode && <div className="absolute top-1 right-1 w-2 h-2 bg-cyan-500 rounded-full border border-white" />}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", isSeaTypeMode ? "text-cyan-600" : "text-slate-500")}>
                          Sea Context
                        </span>
                      </button>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Geoscience (地球科学)</h4>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
                      <button
                        onClick={() => setIs3DEnabled(!is3DEnabled)}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0 snap-start w-12 md:w-14"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center relative shadow-sm",
                          is3DEnabled ? "border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-500/10" : "border-slate-100 bg-slate-50 text-slate-400 group-hover/item:border-blue-200"
                        )}>
                          <Layers className="w-5 h-5" />
                          {is3DEnabled && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", is3DEnabled ? "text-blue-600" : "text-slate-500")}>
                          3D Terrain
                        </span>
                      </button>

                      <button
                        onClick={() => setIsDisasterMode(!isDisasterMode)}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0 snap-start w-12 md:w-14"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center relative shadow-sm",
                          isDisasterMode ? "border-red-500 bg-red-50 text-red-600 ring-4 ring-red-500/10" : "border-slate-100 bg-slate-50 text-slate-400 group-hover/item:border-red-200"
                        )}>
                          <AlertOctagon className={cn("w-5 h-5", isDisasterMode ? "animate-pulse" : "")} />
                          {isDisasterMode && <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", isDisasterMode ? "text-red-600" : "text-slate-500")}>
                          Disaster
                        </span>
                      </button>

                      <button
                        onClick={() => setIsMountainMode(!isMountainMode)}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0 snap-start w-12 md:w-14"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center relative shadow-sm",
                          isMountainMode ? "border-emerald-500 bg-emerald-50 text-emerald-600 ring-4 ring-emerald-500/10" : "border-slate-100 bg-slate-50 text-slate-400 group-hover/item:border-emerald-200"
                        )}>
                          <MountainSnow className="w-5 h-5" />
                          {isMountainMode && <div className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full border border-white" />}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", isMountainMode ? "text-emerald-600" : "text-slate-500")}>
                          Mountain
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setProjection(projection === 'globe' ? 'mercator' : 'globe');
                        }}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0 snap-start w-12 md:w-14"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center relative shadow-sm",
                          projection === 'globe' ? "border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-500/10" : "border-slate-100 bg-slate-50 text-slate-400 group-hover/item:border-blue-200"
                        )}>
                          {projection === 'globe' ? <Globe className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
                          {projection === 'globe' && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", projection === 'globe' ? "text-blue-600" : "text-slate-500")}>
                          {projection === 'globe' ? 'Globe' : 'Flat'}
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className="md:col-start-2">
                     <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Grid Context (グリッド詳細度)</h4>
                     <div className="flex items-center gap-4">
                      <button
                        onClick={() => setIsGridVisible(!isGridVisible)}
                        className="flex flex-col items-center gap-1.5 group/item shrink-0"
                      >
                        <div className={cn(
                          "w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center relative shadow-sm",
                          isGridVisible ? "border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-500/10" : "border-slate-100 bg-slate-50 text-slate-400 group-hover/item:border-blue-200"
                        )}>
                          <Grid3X3 className="w-5 h-5" />
                          {isGridVisible && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />}
                        </div>
                        <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", isGridVisible ? "text-blue-600" : "text-slate-500")}>
                          {isGridVisible ? 'Grid ON' : 'Grid OFF'}
                        </span>
                      </button>

                      <div className="flex-1 px-1">
                         <div className="flex justify-between mb-2 items-center">
                           <div className="flex flex-col">
                             <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">DETAIL LEVEL</span>
                             <span className="text-[9px] font-black text-slate-900 leading-none">RESOLUTION: ~4.4m (UNIFORM)</span>
                           </div>
                           <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black tracking-tighter">{gridOpacityLevel}x</span>
                         </div>
                         <input 
                           type="range" 
                           min="0" 
                           max="5" 
                           step="1"
                           value={gridOpacityLevel} 
                           onChange={(e) => setGridOpacityLevel(parseInt(e.target.value))}
                           className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                         />
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
