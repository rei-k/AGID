import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode } from 'lucide-react';

interface QrScannerModalProps {
  show: boolean;
  onClose: () => void;
  scannerId: string;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  show,
  onClose,
  scannerId
}) => {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col pt-8 pb-10 px-8"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">QR Scanner</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Scan an AGID QR Code</p>
            </div>

            <div id={scannerId} className="w-full aspect-square bg-slate-100 rounded-3xl overflow-hidden border-2 border-slate-100 shadow-inner" />
            
            <button 
              onClick={onClose}
              className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
