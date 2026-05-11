
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Info, Target } from 'lucide-react';

export function CustomAlert({ config, onClose }: { config: { title: string; message: string; show: boolean } | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {config?.show && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[300]"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl shadow-2xl z-[301] p-8 text-center border border-slate-100"
          >
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Info className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">{config.title}</h3>
            <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">{config.message}</p>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              Dismiss
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function CenterActionButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
        >
          <button 
            onClick={onClick}
            className="pointer-events-auto flex items-center justify-center gap-2 w-14 h-14 md:w-auto md:px-6 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-2xl transition-all active:scale-95 group"
          >
            <Target className="w-7 h-7 md:w-4 md:h-4 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest hidden md:block whitespace-nowrap">Select Center</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LicensesOverlay({ show, onClose }: { show: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-xl flex items-center justify-center p-4 md:p-10"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-2xl bg-white shadow-2xl rounded-[2.5rem] border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Open Source Licenses</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Data Providers & Infrastructure</p>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-slate-900 shadow-sm transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              <section className="space-y-4">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Geospatial Data</h4>
                <div className="space-y-4">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-black text-slate-900">OpenStreetMap</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Data © OpenStreetMap contributors. Licensed under the Open Data Commons Open Database License (ODbL) by the OpenStreetMap Foundation (OSMF).
                    </p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-black text-slate-900">IHO / Marine Regions</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Marine region boundaries provided by the International Hydrographic Organization (IHO) via MarineRegions.org.
                    </p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-black text-slate-900">Natural Earth / GEBCO</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Global relief and bathymetry data from General Bathymetric Chart of the Oceans (GEBCO) and Natural Earth datasets.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Frontend Frameworks</h4>
                <div className="grid grid-cols-2 gap-3">
                  {['React', 'Vite', 'Tailwind CSS', 'Framer Motion', 'Lucide React', 'Mapbox GL JS', 'D3.js', 'Recharts'].map(lib => (
                    <div key={lib} className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      {lib}
                    </div>
                  ))}
                </div>
              </section>

              <div className="pt-10 border-t border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Build with ❤️ by GeoGrid Community
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LegalOverlay({ activeDoc, onClose, legalData }: { activeDoc: 'privacy' | 'terms' | null; onClose: () => void; legalData: any }) {
  return (
    <AnimatePresence>
      {activeDoc && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-xl flex items-center justify-center"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full h-full md:h-auto md:max-w-2xl bg-white shadow-2xl md:rounded-[2.5rem] border-x md:border border-slate-100 overflow-hidden flex flex-col md:max-h-[85vh]"
          >
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter">
                  {activeDoc === 'privacy' ? legalData.privacy_policy.title : legalData.terms_of_service.title}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Last Updated: {activeDoc === 'privacy' ? legalData.privacy_policy.updated : legalData.terms_of_service.updated}
                </p>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-slate-900 shadow-sm transition-all active:scale-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 custom-scrollbar">
              {((activeDoc === 'privacy' ? legalData.privacy_policy.sections : legalData.terms_of_service.sections) as any[]).map((section, idx) => (
                <section key={idx} className="space-y-4">
                  <h4 className="text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
                      0{idx + 1}
                    </span>
                    {section.heading}
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium pl-11">
                    {section.content}
                  </p>
                </section>
              ))}

              <div className="pt-10 pb-6 border-t border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  GeoGrid Identity © 2026
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmModal({ config, onClose }: { config: { title: string; message: string; onConfirm: () => void; show: boolean } | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {config?.show && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[300]"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl shadow-2xl z-[301] p-8 text-center border border-slate-100"
          >
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">{config.title}</h3>
            <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">{config.message}</p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={onClose}
                className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  config.onConfirm();
                  onClose();
                }}
                className="py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
