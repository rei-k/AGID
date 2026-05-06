import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface QualityReportModalProps {
  show: boolean;
  onClose: () => void;
  qualityReport: {
    report: string;
    stats: any;
    continentQuality: Record<string, { score: number }>;
  } | null;
}

export const QualityReportModal: React.FC<QualityReportModalProps> = ({
  show,
  onClose,
  qualityReport
}) => {
  return (
    <AnimatePresence>
      {show && qualityReport && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 pointer-events-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">AI Data Quality Report</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Daily Global Sweep Analysis</p>
                </div>
              </div>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(qualityReport.continentQuality || {}).map(([name, data]: [string, any]) => (
                  <div key={name} className="p-4 bg-slate-50 rounded-3xl border border-slate-100 text-center space-y-1">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{name}</div>
                    <div className={cn(
                      "text-2xl font-black",
                      data.score >= 90 ? "text-emerald-600" : 
                      data.score >= 70 ? "text-blue-600" : "text-amber-500"
                    )}>
                      {data.score}%
                    </div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase">Reliability</div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="text-xs font-black uppercase tracking-widest">Engineer Analysis</h3>
                </div>
                <div className="prose prose-sm prose-slate max-w-none">
                  <div className="text-sm font-medium leading-relaxed text-slate-600 whitespace-pre-wrap bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    {qualityReport.report}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={onClose}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg"
              >
                Close Report
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
