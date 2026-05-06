import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Bookmark, 
  History, 
  ShieldCheck as ShieldIcon, 
  BookOpen, 
  Trash2, 
  MapPin, 
  Navigation,
  User,
  Phone,
  Home as HomeIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { TranslationKey } from '../constants/translations';

interface SavedLocationsProps {
  show: boolean;
  onClose: () => void;
  savedAgids: any[];
  savedTab: 'agid' | 'aoid';
  setSavedTab: (tab: 'agid' | 'aoid') => void;
  savedSearch: string;
  setSavedSearch: (search: string) => void;
  t: (key: TranslationKey) => string;
  copyToClipboard: (text: string, id: string) => void;
  copied: string | null;
  deleteSavedAgid: (id: string) => void;
  jumpToSaved: (saved: any) => void;
  aoids: any[];
  setAoids: React.Dispatch<React.SetStateAction<any[]>>;
  setShowAddressRegistration: (show: boolean) => void;
  setLat: (lat: number) => void;
  setLng: (lng: number) => void;
  setZoom: (zoom: number) => void;
  setShowMenu: (show: boolean) => void;
}

export const SavedLocations: React.FC<SavedLocationsProps> = ({
  show,
  onClose,
  savedAgids,
  savedTab,
  setSavedTab,
  savedSearch,
  setSavedSearch,
  t,
  copyToClipboard,
  copied,
  deleteSavedAgid,
  jumpToSaved,
  aoids,
  setAoids,
  setShowAddressRegistration,
  setLat,
  setLng,
  setZoom,
  setShowMenu
}) => {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
          />
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed top-0 left-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[101] border-r border-slate-200 flex flex-col pointer-events-auto"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-none flex items-center justify-center shadow-inner">
                  {savedTab === 'agid' ? <History className="w-5 h-5" /> : <ShieldIcon className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                    {savedTab === 'agid' ? 'Favorites' : 'Verified IDs'}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {savedTab === 'agid' ? 'Public Location History' : 'Registered Private Addresses'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-none transition-all text-slate-400 hover:text-slate-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-1 px-1.5 bg-slate-100/50 m-4 rounded-none border border-slate-200/50 flex">
              <button 
                onClick={() => setSavedTab('agid')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                  savedTab === 'agid' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Locations
              </button>
              <button 
                onClick={() => setSavedTab('aoid')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                  savedTab === 'aoid' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                AOID Registry
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {savedTab === 'agid' ? (
                <>
                  <div className="sticky top-0 z-10 bg-white pb-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={t('search_agid_placeholder')}
                        value={savedSearch}
                        onChange={(e) => setSavedSearch(e.target.value)}
                        className="w-full bg-slate-50 px-4 py-2 pl-10 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  {savedAgids.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-20">
                      <Bookmark className="w-12 h-12 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">No saved AGIDs yet.<br/>Click the bookmark icon to save one.</p>
                    </div>
                  ) : (
                    savedAgids
                      .filter(saved => 
                        saved.id.toLowerCase().includes(savedSearch.toLowerCase()) || 
                        (saved.address && saved.address.toLowerCase().includes(savedSearch.toLowerCase()))
                      )
                      .map((saved) => (
                        <div 
                          key={saved.id}
                          className="group bg-slate-50 rounded-none border border-slate-100 p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-all shadow-sm"
                        >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-blue-600 font-mono">{saved.id.slice(0, 2)}</span>
                            <span className="text-xl font-bold text-slate-700 font-mono">{saved.id.slice(2)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => copyToClipboard(saved.id, 'saved-list-' + saved.id)}
                              className="p-2 hover:bg-white rounded-none text-slate-400 hover:text-blue-600 transition-all shadow-sm"
                              title="Copy AGID"
                            >
                              <BookOpen className={cn("w-4 h-4", copied === ('saved-list-' + saved.id) ? "text-green-500" : "")} />
                            </button>
                            <button 
                              onClick={() => deleteSavedAgid(saved.id)}
                              className="p-2 hover:bg-white rounded-none text-slate-400 hover:text-red-600 transition-all shadow-sm"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {saved.address && (
                          <div className="flex items-start gap-2 mb-3">
                            <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{saved.address}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                          <span className="text-[9px] font-bold text-slate-300 uppercase">
                            {new Date(saved.savedAt).toLocaleDateString()}
                          </span>
                          <button 
                            onClick={() => jumpToSaved(saved)}
                            className="text-[10px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 group/jump"
                          >
                            JUMP TO MAP
                            <Navigation className="w-3 h-3 group-hover/jump:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <>
                  <div className="sticky top-0 z-10 bg-white pb-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={t('search_aoid_placeholder')}
                        value={savedSearch}
                        onChange={(e) => setSavedSearch(e.target.value)}
                        className="w-full bg-slate-50 px-4 py-2 pl-10 rounded-none border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  {aoids.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-12">
                      <ShieldIcon className="w-12 h-12 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">No AOIDs registered yet.<br/>Create private IDs for your locations.</p>
                      <button 
                        onClick={() => { setShowAddressRegistration(true); onClose(); }}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-none font-bold text-xs shadow-lg shadow-emerald-100"
                      >
                        Register First AOID
                      </button>
                    </div>
                  ) : (
                    aoids
                      .filter(aoid => 
                        aoid.id.toLowerCase().includes(savedSearch.toLowerCase()) || 
                        aoid.name.toLowerCase().includes(savedSearch.toLowerCase()) ||
                        aoid.address.toLowerCase().includes(savedSearch.toLowerCase())
                      )
                      .map((aoid) => (
                        <div 
                          key={aoid.id}
                          className="bg-white rounded-none border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="bg-emerald-50 px-3 py-1 rounded-none border border-emerald-100">
                              <span className="text-lg font-black text-emerald-700 font-mono tracking-tighter">{aoid.id}</span>
                            </div>
                            <button 
                              onClick={() => setAoids(prev => prev.filter(a => a.id !== aoid.id))}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs font-black text-slate-800">{aoid.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs font-bold text-slate-500">{aoid.phone}</span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-slate-50">
                              <div className="flex items-start gap-2">
                                <HomeIcon className="w-3 h-3 text-emerald-400 mt-0.5" />
                                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                                  {aoid.address} {aoid.building} {aoid.room}
                                </p>
                              </div>
                            </div>
                          </div>

                          <button 
                            onClick={() => {
                              setLat(aoid.lat);
                              setLng(aoid.lng);
                              setZoom(20);
                              onClose();
                              setShowMenu(false);
                            }}
                            className="w-full mt-4 py-2 bg-slate-50 text-slate-600 rounded-none text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-100 group-hover:border-emerald-200"
                          >
                            View on Map
                          </button>
                        </div>
                      ))
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
