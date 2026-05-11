
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Globe, 
  Bookmark, 
  Shield as ShieldIcon, 
  Home as HomeIcon, 
  History, 
  Settings, 
  HelpCircle, 
  Share2, 
  Search 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SideMenuProps {
  show: boolean;
  onClose: () => void;
  setSavedTab: (t: 'agid' | 'aoid') => void;
  setShowSaved: (s: boolean) => void;
  setAoidModeForced: (f: boolean) => void;
  setShowAddressRegistration: (r: boolean) => void;
  setShowHistory: (h: boolean) => void;
  setShowSettings: (s: boolean) => void;
  setSettingsTab: (t: string) => void;
  handleShare: () => void;
  isSearchVisible: boolean;
  setSearchVisible: (v: boolean) => void;
  appLanguage: string;
  setAppLanguage: (l: string) => void;
  t: (key: any) => string;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  show,
  onClose,
  setSavedTab,
  setShowSaved,
  setAoidModeForced,
  setShowAddressRegistration,
  setShowHistory,
  setShowSettings,
  setSettingsTab,
  handleShare,
  isSearchVisible,
  setSearchVisible,
  appLanguage,
  setAppLanguage,
  t
}) => {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] pointer-events-auto"
          />
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350, mass: 1 }}
            className="fixed top-0 left-0 bottom-0 w-72 md:w-56 bg-white/95 backdrop-blur-xl shadow-2xl z-[101] pointer-events-auto flex flex-col border-r border-white/20 md:rounded-r-[2.5rem]"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingLeft: 'env(safe-area-inset-left)',
            }}
          >
            <div className="px-5 py-6 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-slate-900 flex items-center justify-center">
                  <Globe className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <span className="text-xl font-black tracking-tighter text-slate-900 uppercase block leading-none">AGID</span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 active:scale-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-6 space-y-8 custom-scrollbar">
              {/* Personal Section */}
              <section className="space-y-4">
                <h3 className="px-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('personal_space')}</h3>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    { icon: Bookmark, label: t('saved_locations'), color: "blue", onClick: () => { setSavedTab('agid'); setShowSaved(true); } },
                    { icon: ShieldIcon, label: t('verified_aoids'), color: "emerald", onClick: () => { setSavedTab('aoid'); setShowSaved(true); } },
                    { icon: HomeIcon, label: t('register_address'), color: "blue", onClick: () => { setAoidModeForced(false); setShowAddressRegistration(true); } },
                  ].map((item, idx) => (
                    <motion.button 
                      key={idx}
                      whileHover={{ x: 4 }}
                      onClick={() => { item.onClick(); onClose(); }}
                      className="w-full flex items-center gap-2 px-3 py-3 hover:bg-slate-50 rounded-xl transition-all group"
                    >
                      <div className={cn(
                        "transition-all",
                        item.color === 'blue' ? "text-blue-600 group-hover:text-blue-700" :
                        "text-emerald-600 group-hover:text-emerald-700"
                      )}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* Discovery Section */}
              <section className="space-y-4">
                <h3 className="px-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('discovery')}</h3>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    { icon: Search, label: t('advanced_search'), onClick: () => setSearchVisible(true) },
                    { icon: History, label: t('search_history'), onClick: () => setShowHistory(true) },
                  ].map((item, idx) => (
                    <motion.button 
                      key={idx}
                      whileHover={{ x: 4 }}
                      onClick={() => { item.onClick(); onClose(); }}
                      className="w-full flex items-center gap-2 px-3 py-3 hover:bg-slate-50 rounded-xl transition-all group"
                    >
                      <div className="text-slate-400 group-hover:text-slate-900 transition-all">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* Extras Section */}
              <section className="space-y-4">
                <h3 className="px-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('system')}</h3>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    { icon: Settings, label: t('settings'), onClick: () => setShowSettings(true) },
                    { icon: HelpCircle, label: t('help'), onClick: () => { setShowSettings(true); setSettingsTab('help'); } },
                    { icon: Share2, label: t('share_app'), onClick: handleShare },
                  ].map((item, idx) => (
                    <motion.button 
                      key={idx}
                      whileHover={{ x: 4 }}
                      onClick={() => { item.onClick(); onClose(); }}
                      className="w-full flex items-center gap-2 px-3 py-3 hover:bg-slate-50 rounded-xl transition-all group"
                    >
                      <div className="text-slate-400 group-hover:text-slate-900 transition-all">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 mb-safe">
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                  Absolute Grid Identity (AGID)
                </p>
                <p className="text-[10px] font-bold text-slate-900 mt-1">
                  Build 2.4.0 (Stable)
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
