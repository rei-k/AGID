
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  LocateFixed, 
  Plus, 
  Minus 
} from 'lucide-react';
import { cn } from '../lib/utils';
import maplibregl from 'maplibre-gl';

interface MapControlsProps {
  mapBearing: number;
  setMapBearing: (b: number) => void;
  isTracking: boolean;
  isLocating: boolean;
  toggleTracking: () => void;
  setShowStyleMenu: (s: boolean) => void;
  clickedAgid: any;
  isAgidPanelCollapsed: boolean;
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
}

export const MapControls: React.FC<MapControlsProps> = ({
  mapBearing,
  setMapBearing,
  isTracking,
  isLocating,
  toggleTracking,
  setShowStyleMenu,
  clickedAgid,
  isAgidPanelCollapsed,
  mapRef
}) => {
  return (
    <div className={cn(
      "absolute z-40 flex flex-col gap-2 md:gap-1.5 pointer-events-none transition-all duration-500 items-end",
      "right-2 md:right-3",
      clickedAgid 
        ? (isAgidPanelCollapsed ? "bottom-24" : "bottom-72 md:bottom-80") 
        : "bottom-8 md:bottom-6"
    )}>
      {/* Upper Group: Compass (Only when tilted) */}
      <div className="flex flex-col gap-2 md:gap-2 items-end">
        <AnimatePresence>
          {mapBearing !== 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="pointer-events-auto"
            >
              <button 
                onClick={() => {
                  mapRef.current?.setBearing(0);
                  setMapBearing(0);
                }}
                className="w-10 h-10 md:w-8 md:h-8 rounded-none bg-white shadow-lg border border-slate-200 flex items-center justify-center relative overflow-hidden"
                title="コンパスをリセット"
              >
                <div 
                  className="relative w-6 h-6 md:w-5 md:h-5 transition-transform duration-300 ease-out"
                  style={{ transform: `rotate(${-mapBearing}deg)` }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 md:h-2.5 bg-red-500 rounded-none" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 md:h-2.5 bg-slate-400 rounded-none" />
                  <span className="absolute top-[-1px] left-1/2 -translate-x-1/2 text-[9px] font-black text-red-500 select-none">N</span>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Controls Group: Layers, Geocoding (Locate), Zoom */}
      <div className="flex flex-col gap-2 md:gap-0 mt-auto items-end">
        {/* Layer Button */}
        <div className="pointer-events-auto mb-1.5 md:mb-1.5">
          <button 
            onClick={() => setShowStyleMenu(true)}
            className="w-9 h-9 md:w-8 md:h-8 rounded-none bg-white shadow-lg border border-slate-200 flex items-center justify-center group hover:bg-slate-50 transition-all"
            title="レイヤー"
          >
            <Layers className="w-4.5 h-4.5 md:w-4 md:h-4 text-slate-600" />
          </button>
        </div>

        {/* Locate Button (Geocoding / My Location) */}
        <div className="pointer-events-auto mb-1.5 md:mb-1.5 relative">
          <button 
            onClick={toggleTracking}
            className={cn(
              "w-9 h-9 md:w-8 md:h-8 rounded-none bg-white shadow-lg border border-slate-200 flex items-center justify-center transition-all active:scale-95 group relative",
              isTracking ? "text-blue-600 border-blue-200" : "text-slate-600"
            )}
            title="現在地表示"
          >
            <LocateFixed className={cn("w-4.5 h-4.5 md:w-4 md:h-4", (isTracking || isLocating) && "animate-pulse")} />
          </button>
        </div>

        {/* Zoom Controls (PC only) */}
        <div className="hidden md:flex flex-col bg-white rounded-none shadow-lg border border-slate-200 pointer-events-auto overflow-hidden">
          <button 
            onClick={() => mapRef.current?.zoomIn()}
            className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 transition-colors border-b border-slate-100 text-slate-600"
            title="拡大"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button 
            onClick={() => mapRef.current?.zoomOut()}
            className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-600"
            title="縮小"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
