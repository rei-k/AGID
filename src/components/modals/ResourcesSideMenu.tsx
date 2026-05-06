import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Database, Globe } from 'lucide-react';

interface ResourcesSideMenuProps {
  show: boolean;
  onClose: () => void;
  registryStats: any;
  majorCategories: any[];
}

export const ResourcesSideMenu: React.FC<ResourcesSideMenuProps> = ({
  show,
  onClose,
  registryStats,
  majorCategories
}) => {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
          />
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed top-0 right-0 bottom-0 w-80 lg:w-64 bg-white shadow-2xl z-[1001] border-l border-slate-200 flex flex-col pointer-events-auto"
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <button 
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                </button>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-none">Reference</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Tools & GIS</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Global Stats</h3>
                </div>
                
                <div className="space-y-2">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Total Grid Points</div>
                    <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter">
                      {registryStats?.globalStats?.total?.toLocaleString() || "142M+ Bars"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Region Distribution</h3>
                </div>
                <div className="space-y-3">
                  {majorCategories.map(cat => {
                    const stats = registryStats.regionStats[cat.id];
                    if (!stats || stats.total === 0) return null;
                    const percentage = Math.round((stats.total / registryStats.globalStats.total) * 100);
                    return (
                      <div key={cat.id} className="space-y-1.5 px-1">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{cat.name}</span>
                          <span className="text-[9px] font-bold text-slate-900">{percentage}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-slate-900 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
