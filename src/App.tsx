import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchWithRetry } from './lib/utils';
import { bearing, distance, polygon, bboxPolygon, difference, featureCollection, area } from '@turf/turf';
import { TRANSLATIONS, TranslationKey } from './constants/translations';
import { 
  encodeAGID, 
  decodeAGID, 
  SEA_REGIONS, 
  COUNTRY_REGIONS, 
  LAND_REGIONS, 
  AGIDResult, 
  getRegionInfo, 
  getGridFeatures, 
  calculateTotalSeaAreas,
  generatePrefix,
  generateFullSeaRegistry,
  generateFullCountryRegistry
} from './lib/agid';
import { calculateDistance, calculateBearing, formatDistance } from './lib/nav';
import legalData from './data/legal.json';
import disputedTerritories from './data/disputed_territories.json';
import { 
  X, 
  Menu, 
  Search, 
  History, 
  Settings, 
  Info, 
  ChevronRight, 
  MapPin, 
  Share2, 
  Layers, 
  Target, 
  ArrowUpRight, 
  Truck, 
  User, 
  Zap, 
  LocateFixed, 
  ChevronDown, 
  Check, 
  Copy, 
  Maximize2, 
  Key, 
  QrCode, 
  ExternalLink, 
  ArrowLeft, 
  Clock, 
  Sparkles, 
  Flag, 
  MountainSnow, 
  Camera, 
  Upload, 
  BarChart3, 
  Landmark, 
  Anchor, 
  Waves, 
  AlertOctagon, 
  Globe, 
  Map as MapIcon, 
  Grid3X3, 
  RotateCcw, 
  Plus, 
  Minus, 
  Smartphone, 
  ShieldCheck, 
  Download, 
  FileDown, 
  FileText, 
  Bookmark, 
  Database, 
  Trash2, 
  BookOpen, 
  ArrowRight, 
  Scale, 
  Activity, 
  Box,
  ChevronUp,
  HelpCircle,
  RefreshCw,
  ArrowUpDown,
  Compass,
  Ruler,
  Coffee,
  Train,
  ShoppingBag,
  Phone,
  Home as HomeIcon,
  Snowflake,
  Trees,
  Palmtree,
  Ship,
  Sun,
  Building2,
  AlertCircle,
  CheckCircle2,
  Settings2,
  ShieldAlert
} from 'lucide-react';

// Extracted Components
import { MapControls } from './components/MapControls';
import { MapLayersMenu } from './components/MapLayersMenu';
import { GridDetailPanel } from './components/GridDetailPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SideMenu } from './components/SideMenu';
import { SearchSidebar } from './components/SearchSidebar';

import { QRCodeCanvas } from 'qrcode.react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  LANGUAGES,
  COUNTRY_LANGUAGES,
  BIG_TO_SMALL_COUNTRIES,
  formatAddress,
  translateAddressOpenSource,
  normalizeAddressText,
  fastJapaneseTransliterate
} from './lib/addressUtils';
import { 
  normalizeAddress, 
  parseAddress, 
  fetchNearbyOSMPlaces, 
  fetchNearestRoad,
  smartSearch, 
  regionalReverseGeocode,
  db as placeDb 
} from './services/GeocodingService';
import { getPatternForPrefix, applySmartPattern, NO_POSTAL_COUNTRIES } from './lib/postalPatterns';
const AddressRegistration = React.lazy(() => import('./components/AddressRegistration').then(m => ({ default: m.AddressRegistration })));
const PostalCodeLab = React.lazy(() => import('./components/PostalCodeLab').then(m => ({ default: m.PostalCodeLab })));
const GeoArchitectPanel = React.lazy(() => import('./components/GeoArchitectPanel').then(m => ({ default: m.GeoArchitectPanel })));
import { wgs84togcj02, wgs84tobd09 } from './lib/coordTransform';
import { GuidanceEngine, MapProvider } from './lib/guidanceEngine';
import { generateAOID, AOIDData } from './lib/aoid';
import { RoutingService, travelMode } from './services/RoutingService';
import { COUNTRIES, CountryInfo } from './constants/countries';

import { 
  RESOURCE_CATEGORIES, 
  SYSTEMATIC_THEMES, 
  REGIONAL_THEMES, 
  MAJOR_CATEGORIES 
} from './constants/appConstants';

const getMajorCategory = (c: CountryInfo) => {
  if (c.type === 'Disputed') return 'Disputed';
  if (c.type === 'Territory' || c.type === 'Autonomous') return 'Territories';
  
  const r = c.region;
  if (r.includes('Asia') || r.includes('Middle East')) return 'Asia';
  if (r.includes('Africa')) return 'Africa';
  if (r.includes('Oceania')) return 'Oceania';
  if (r.includes('America') || r.includes('Caribbean')) return 'Americas';
  if (r.includes('Europe')) return 'Europe';
  if (r.includes('Caucasus')) return 'Asia'; // Or Europe? Usually transcontinental, but keeping Asia/MidEast together
  return 'Other';
};

import { FullSeaRegistryView, FullCountryRegistryView } from './components/RegistryViews';
import { LicensesOverlay, LegalOverlay, ConfirmModal, CustomAlert, CenterActionButton } from './components/Overlays';
import { QualityReportModal } from './components/modals/QualityReportModal';
import { QrScannerModal } from './components/modals/QrScannerModal';
import { ResourcesSideMenu } from './components/modals/ResourcesSideMenu';
import { SavedLocations } from './components/SavedLocations';
import { ExportService, ExportData } from './services/ExportService';
import { saveAs } from 'file-saver';

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const gridUpdateTimer = useRef<any>(null);
  const gridWorker = useRef<Worker | null>(null);
  const isSelectingResult = useRef(false);
  const lastPropsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    gridWorker.current = new Worker(new URL('./lib/gridWorker.ts', import.meta.url), { type: 'module' });
    
    // Explicitly enable grid on mount to satisfy user request
    setIsGridVisible(true);

    // Error Handling for Grid Worker
    gridWorker.current.onerror = (e) => {
      console.error("Grid Worker Error:", e);
      showAlert(t('engine_error_title'), t('engine_error_body'));
    };

    // Network Status Lifecycle
    const handleOffline = () => {
      showAlert(t('offline_mode_title'), t('offline_mode_body'));
    };
    const handleOnline = () => {
      showAlert(t('online_mode_title'), t('online_mode_body'));
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      gridWorker.current?.terminate();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  
  // URL Params
  const urlParams = new URLSearchParams(window.location.search);
  // Device-specific zoom determination
  const getDeviceZoom = () => {
    const w = window.innerWidth;
    // Area size is fixed by device (~120m viewport width)
    if (w < 640) return 20.2; // Smartphone: ~110m width
    if (w < 1024) return 19.8; // Tablet: ~130m width
    return 19.5; // PC: ~160m width
  };

  const initialLat = parseFloat(urlParams.get('lat') || '35.6812'); // Tokyo Station
  const initialLng = parseFloat(urlParams.get('lng') || '139.7671');
  const initialZoom = parseFloat(urlParams.get('zoom') || getDeviceZoom().toString());

  const [lng, setLng] = useState(initialLng);
  const [lat, setLat] = useState(initialLat);
  const [zoom, setZoom] = useState(initialZoom);
  const [mapBearing, setMapBearing] = useState(0);
  const [mapPitch, setMapPitch] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_map_pitch');
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch { return 0; }
  });
  const [gridOpacityLevel, setGridOpacityLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_grid_opacity_level');
      return saved !== null ? parseInt(saved, 10) : 3; // Range: 0 to 5
    } catch { return 3; }
  });
  const [showResources, setShowResources] = useState(false);
  const [resourceSearch, setResourceSearch] = useState("");
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [isManualSelection, setIsManualSelection] = useState(false);
  const [isNauticalMode, setIsNauticalMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_nautical_mode');
      return saved !== null ? JSON.parse(saved) : true; 
    } catch { return true; }
  });
  const [isSeaTypeMode, setIsSeaTypeMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_sea_type_mode');
      return saved !== null ? JSON.parse(saved) : true;
    } catch { return true; }
  });
  // Language & Format Defaults - MOVED UP
  const [appLanguage, setAppLanguage] = useState<string>(() => {
    try {
      return localStorage.getItem('agid_app_language') || 'ja';
    } catch { return 'ja'; }
  });
  const [addressLanguage, setAddressLanguage] = useState<string>(() => {
    try {
      return localStorage.getItem('agid_address_language') || 'en';
    } catch { return 'en'; }
  });
  const [defaultAddrTab, setDefaultAddrTab] = useState<'local' | 'en'>(() => {
    try {
      return (localStorage.getItem('agid_default_addr_tab') as 'local' | 'en') || 'local';
    } catch { return 'local'; }
  });

  const [navigationTarget, setNavigationTarget] = useState<{ lat: number, lng: number } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isGuidanceActive, setIsGuidanceActive] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [isRulerMode, setIsRulerMode] = useState(false);
  const [rulerPoints, setRulerPoints] = useState<[number, number][]>([]);
  const [isRoutePlanning, setIsRoutePlanning] = useState(false);
  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [originResults, setOriginResults] = useState<any[]>([]);
  const [destinationResults, setDestinationResults] = useState<any[]>([]);
  const [origin, setOrigin] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [destination, setDestination] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const [clickedAgid, setClickedAgid] = useState<AGIDResult | null>(null);
  const [clickedAddress, setClickedAddress] = useState<string>("");
  const [clickedAddressEn, setClickedAddressEn] = useState<string>("");
  const [clickedAddressTranslated, setClickedAddressTranslated] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCoordinateSearch, setShowCoordinateSearch] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isAgidPinnedToGps, setIsAgidPinnedToGps] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isGridRegenerating, setIsGridRegenerating] = useState(false);
  const [isStyleLoading, setIsStyleLoading] = useState(false);

  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [clickedAddressDetails, setClickedAddressDetails] = useState<any>(null);
  const [clickedAddressMap, setClickedAddressMap] = useState<Record<string, string>>({});
  const [clickedActiveLangs, setClickedActiveLangs] = useState<string[]>(() => {
    const base = ['en'];
    if (addressLanguage && addressLanguage !== 'en' && addressLanguage !== 'local') {
      base.push(addressLanguage);
    }
    return base;
  });
  const [settingsTab, setSettingsTab] = useState<'main' | 'home' | 'app' | 'location' | 'offline' | 'about' | 'app-language' | 'address-language' | 'help' | 'export'>('main');
  const [activeLegalDoc, setActiveLegalDoc] = useState<'privacy' | 'terms' | null>(null);
  const [showLicenses, setShowLicenses] = useState(false);
  const [clickedAddressLang, setClickedAddressLang] = useState<string>("Local");
  const [clickedAddressTab, setClickedAddressTab] = useState<string>(() => {
    if (addressLanguage === 'local') return 'local';
    return addressLanguage || 'en';
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [savedAgids, setSavedAgids] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('saved_agids');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [savedQrs, setSavedQrs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('saved_qrs');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [homeAgid, setHomeAgid] = useState<string>(() => {
    try {
      return localStorage.getItem('agid_home_agid') || "";
    } catch { return ""; }
  });
  const [isShippingMode, setIsShippingMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_shipping_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  // QR Scanning States
  const [isQrScanning, setIsQrScanning] = useState(false);
  const [isQrVisible, setIsQrVisible] = useState(false);
  const [showLocationAnalysis, setShowLocationAnalysis] = useState(false);
  const [isAgidPanelCollapsed, setIsAgidPanelCollapsed] = useState(false);

  const qrScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [savedTab, setSavedTab] = useState<'agid' | 'aoid' | 'qr'>('agid');
  const [showAddressRegistration, setShowAddressRegistration] = useState(false);
  const [showQualityReport, setShowQualityReport] = useState(false);
  const [qualityReport, setQualityReport] = useState<{ report: string, stats: any, continentQuality: any } | null>(null);
  const [isQualityLoading, setIsQualityLoading] = useState(false);
  const [aoidModeForced, setAoidModeForced] = useState(false);
  const [showPostalCodeLab, setShowPostalCodeLab] = useState(false);
  const [isTerritoryLabOpen, setIsTerritoryLabOpen] = useState(false);
  const [postalLabStyle, setPostalLabStyle] = useState<'smart' | 'numeric' | 'alphanumeric' | 'hybrid'>('smart');
  const [postalDigitCount, setPostalDigitCount] = useState<number>(4);
  const [labCountryStats, setLabCountryStats] = useState<any>(null);
  const [labGeneratedCode, setLabGeneratedCode] = useState("");
  const [isLoadingLabStats, setIsLoadingLabStats] = useState(false);
  const [selectedCountryBoundary, setSelectedCountryBoundary] = useState<any | null>(null);
  const [selectedRegionBoundary, setSelectedRegionBoundary] = useState<any | null>(null);
  const [showGeoArchitect, setShowGeoArchitect] = useState(false);
  const [aoids, setAoids] = useState<any[]>([]);
  const [nearestRoad, setNearestRoad] = useState<any>(null);
  const [useBidirectionalDijkstra, setUseBidirectionalDijkstra] = useState(false);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const [routingMode, setRoutingMode] = useState<travelMode>('driving');
  const [defaultNavApp, setDefaultNavApp] = useState<string>(() => {
    return localStorage.getItem('agid_default_nav_app') || 'google';
  });

  // Local Storage Persistence for settings and state
  useEffect(() => {
    const savedDefaultNav = localStorage.getItem('agid-default-nav');
    if (savedDefaultNav) setDefaultNavApp(savedDefaultNav as any);
  }, []);

  useEffect(() => {
    localStorage.setItem('agid-default-nav', defaultNavApp);
  }, [defaultNavApp]);

  // Local Storage Persistence for AOIDs
  useEffect(() => {
    const saved = localStorage.getItem('agid_grid_aoids');
    if (saved) {
      try {
        setAoids(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load AOIDs", e);
      }
    }
  }, []);

  // Territory Lab Statistics Logic
  useEffect(() => {
    if (isTerritoryLabOpen && clickedAgid) {
      const cc = clickedAgid.prefix;
      if (labCountryStats?.country_code === cc) return; // Prevent loop
      
      setIsLoadingLabStats(true);
      fetch(`/api/country-stats?cc=${cc}`)
        .then(res => res.json())
        .then(data => {
          setLabCountryStats(data);
          setIsLoadingLabStats(false);
        })
        .catch(err => {
          console.error("Failed to fetch lab stats:", err);
          setIsLoadingLabStats(false);
        });
    }
  }, [isTerritoryLabOpen, clickedAgid?.id, labCountryStats?.country_code]);

  useEffect(() => {
    if (clickedAgid) {
      const pattern = getPatternForPrefix(clickedAgid.prefix) || {
        country: 'Experimental',
        format: 'N'.repeat(postalDigitCount),
        regex: /.*/,
        example: '1'.repeat(postalDigitCount),
        description: 'Generic experimental format.'
      };
      
      let code = '';
      if (postalLabStyle === 'smart') {
        const adjustedPattern = { ...pattern, format: 'N'.repeat(postalDigitCount) };
        code = applySmartPattern(clickedAgid.id, adjustedPattern);
      } else if (postalLabStyle === 'numeric') {
        const hash = clickedAgid.hash;
        code = `${clickedAgid.prefix}${parseInt(hash, 36).toString().slice(0, postalDigitCount)}`;
      } else if (postalLabStyle === 'alphanumeric') {
        code = `${clickedAgid.prefix}${clickedAgid.hash.slice(0, postalDigitCount).toUpperCase()}`;
      } else {
        code = `${clickedAgid.prefix}·${clickedAgid.hash.slice(0, postalDigitCount).toUpperCase()}·XP`;
      }
      setLabGeneratedCode(code);
    }
  }, [clickedAgid?.id, postalLabStyle, postalDigitCount]);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);

  const registryStats = useMemo(() => {
    const regionStats: Record<string, any> = {};
    MAJOR_CATEGORIES.forEach(cat => {
      regionStats[cat.id] = { total: 0, country: 0, territory: 0, autonomous: 0, disputed: 0, special: 0 };
    });
    
    const globalStats = { total: 0, country: 0, territory: 0, autonomous: 0, disputed: 0, special: 0 };

    COUNTRIES.forEach(c => {
      const category = getMajorCategory(c);
      if (category === 'Other') return;
      
      const type = (c.type || 'Country').toLowerCase() as keyof typeof globalStats;
      
      regionStats[category].total++;
      if (regionStats[category][type] !== undefined) regionStats[category][type]++;
      
      globalStats.total++;
      if (globalStats[type] !== undefined) globalStats[type]++;
    });

    return { regionStats, globalStats };
  }, []);

  const [geoConfig, setGeoConfig] = useState<any>(null);
  const [savedSearch, setSavedSearch] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [coordFormat, setCoordFormat] = useState<'decimal' | 'dms'>(() => {
    try {
      return (localStorage.getItem('agid_coord_format') as 'decimal' | 'dms') || 'decimal';
    } catch { return 'decimal'; }
  });

  const t = React.useCallback((key: TranslationKey, params?: Record<string, string | number>) => {
    let str = (TRANSLATIONS as any)[appLanguage]?.[key] || (TRANSLATIONS as any)['en']?.[key] || key;
    if (params && typeof str === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{{${k}}}`, String(v));
      });
    }
    return str;
  }, [appLanguage]);
  const [showFullSeaRegistry, setShowFullSeaRegistry] = useState(false);
  const [showFullCountryRegistry, setShowFullCountryRegistry] = useState(false);
  const fullSeaRegistry = useMemo(() => generateFullSeaRegistry(), []);
  const fullCountryRegistry = useMemo(() => generateFullCountryRegistry(), []);

  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    try {
      return (localStorage.getItem('agid_theme_mode') as 'light' | 'dark' | 'system') || 'system';
    } catch { return 'system'; }
  });
  const [distanceUnit, setDistanceUnit] = useState<'automatic' | 'kilometers' | 'miles' | 'nautical'>(() => {
    try {
      return (localStorage.getItem('agid_distance_unit') as 'automatic' | 'kilometers' | 'miles' | 'nautical') || 'automatic';
    } catch { return 'automatic'; }
  });
  const [is3DEnabled, setIs3DEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_3d_enabled');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  
  useEffect(() => { localStorage.setItem('agid_map_pitch', mapPitch.toString()); }, [mapPitch]);
  useEffect(() => { localStorage.setItem('agid_grid_opacity_level', gridOpacityLevel.toString()); }, [gridOpacityLevel]);

  // Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else if (themeMode === 'light') {
      root.classList.remove('dark');
    } else {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (systemTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [themeMode]);

  // Translation Service with fallback instances and robustness
  const translateAddress = React.useCallback(async (text: string, target: string, details?: any) => {
    if (!text || target === 'local') return text;
    
    // 1. Normalization
    const normalizedText = normalizeAddressText(text);
    
    // Convert our language codes to LibreTranslate codes
    const targetCode = target === 'zh-Hans' ? 'zh' : (target === 'zh-Hant' ? 'zt' : target);
    
    // Skip standard translation instances for Japanese-to-English to ensure Romaji via Gemini
    if (target !== 'en' || !/[\u3040-\u30ff\u4e00-\u9faf]/.test(normalizedText)) {
      const instances = [
        "https://translate.argosopentech.com/translate",
        "https://libretranslate.de/translate",
        "https://translate.terraprint.co/translate",
        "https://translate.fortland.io/translate",
        "https://translate.api.skidder.xyz/translate",
        "https://libretranslate.pussthecat.org/translate",
        "https://translate.trom.tf/translate"
      ];

      for (const url of instances) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout per instance

          const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
              q: normalizedText,
              source: "auto",
              target: targetCode,
              format: "text"
            }),
            headers: { "Content-Type": "application/json" },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (res.ok) {
            const data = await res.json();
            if (data.translatedText) return data.translatedText;
          }
        } catch (err) {
          console.warn(`Translation failed for ${url}:`, err);
          continue; // Try next instance
        }
      }
    }
    
    // Final Fallback: Open Source Local Logic & Transliteration
    return translateAddressOpenSource(text, target, details);
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Handle user's preferred address language if not in clickedActiveLangs
    if (clickedAddress && addressLanguage && addressLanguage !== 'local' && !clickedActiveLangs.includes(addressLanguage)) {
      translateAddress(clickedAddress, addressLanguage, clickedAddressDetails).then(translated => {
        if (isMounted) {
          setClickedAddressTranslated(prev => prev !== translated ? translated : prev);
        }
      });
    }

    return () => { isMounted = false; };
  }, [clickedAddress, clickedActiveLangs.join(','), translateAddress, clickedAddressLang, addressLanguage]);

  // Sync tab with preferred address language when it changes
  useEffect(() => {
    if (addressLanguage) {
      setClickedAddressTab(addressLanguage);
      if (addressLanguage !== 'local' && addressLanguage !== 'en' && !clickedActiveLangs.includes(addressLanguage)) {
        setClickedActiveLangs(prev => [...prev, addressLanguage]);
      }
    }
  }, [addressLanguage]);

  const [showHubs, setShowHubs] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_show_hubs');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [showFloodRiskLayer, setShowFloodRiskLayer] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_show_flood_risk');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [showLandslideRiskLayer, setShowLandslideRiskLayer] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_show_landslide_risk');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [isDisasterMode, setIsDisasterMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_disaster_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [isMountainMode, setIsMountainMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_mountain_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [isDeepSeaMode, setIsDeepSeaMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_deep_sea_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [isWaterlessEarthMode, setIsWaterlessEarthMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_waterless_earth_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [isHeritageMode, setIsHeritageMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_heritage_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [isGisMode, setIsGisMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_gis_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [gisLayer, setGisLayer] = useState<'population' | 'landuse' | 'soil'>(() => {
    try {
      return (localStorage.getItem('agid_gis_layer') as any) || 'population';
    } catch { return 'population'; }
  });
  const [isSystematicMode, setIsSystematicMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_systematic_mode');
      return saved !== null ? JSON.parse(saved) : true; 
    } catch { return true; }
  });
  const [systematicCategory, setSystematicCategory] = useState<'physical' | 'human'>(() => {
    try {
      return (localStorage.getItem('agid_systematic_category') as any) || 'physical';
    } catch { return 'physical'; }
  });
  const [systematicSubCategory, setSystematicSubCategory] = useState<string>(() => {
    try {
      return localStorage.getItem('agid_systematic_subcategory') || 'climatology';
    } catch { return 'climatology'; }
  });
  const [systematicTheme, setSystematicTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('agid_systematic_theme') || 'all';
    } catch { return 'all'; }
  });
  const [isRegionalMode, setIsRegionalMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_regional_mode');
      return saved !== null ? JSON.parse(saved) : true; 
    } catch { return true; }
  });
  const [regionalType, setRegionalType] = useState<'static' | 'dynamic'>(() => {
    try {
      return (localStorage.getItem('agid_regional_type') as any) || 'static';
    } catch { return 'static'; }
  });
  const [regionalTheme, setRegionalTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('agid_regional_theme') || 'all';
    } catch { return 'all'; }
  });
  const [mapStyle, setMapStyle] = useState(() => {
    try {
      return localStorage.getItem('agid_map_style') || 'https://tiles.openfreemap.org/styles/liberty';
    } catch { return 'https://tiles.openfreemap.org/styles/liberty'; }
  });
  const [projection, setProjection] = useState<'mercator' | 'globe'>(() => {
    try {
      return (localStorage.getItem('agid_projection') as 'mercator' | 'globe') || 'mercator';
    } catch { return 'mercator'; }
  });
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Custom UI for alerts and confirms
  const [alertConfig, setAlertConfig] = useState<{ show: boolean, title: string, message: string } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

  const ensureSourceAndLayer = React.useCallback((id: string, type: string, data: any, paint: any, layout: any = {}, filter?: any, beforeId?: string) => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const sourceId = id;
    const layerId = id + '-layer';

    try {
      if (!map.current.getSource(sourceId)) {
        map.current.addSource(sourceId, { type: 'geojson', data });
        const layerConfig: any = { id: layerId, type: type as any, source: id, paint, layout };
        if (filter !== undefined) layerConfig.filter = filter;
        
        map.current.addLayer(layerConfig, (beforeId && map.current.getLayer(beforeId)) ? beforeId : undefined);
      } else {
        const source: any = map.current.getSource(sourceId);
        if (source.setData) source.setData(data);

        // Diff and update props ONLY if they changed to avoid MapLibre overhead
        const prevProps = lastPropsRef.current[layerId];
        const propsChanged = !prevProps || JSON.stringify(prevProps.paint) !== JSON.stringify(paint) || JSON.stringify(prevProps.layout) !== JSON.stringify(layout);

        if (propsChanged) {
          Object.entries(paint).forEach(([key, value]) => {
            map.current?.setPaintProperty(layerId, key, value);
          });
          Object.entries(layout).forEach(([key, value]) => {
            map.current?.setLayoutProperty(layerId, key, value);
          });
          if (filter !== undefined) map.current.setFilter(layerId, filter);
          lastPropsRef.current[layerId] = { paint, layout };
        }
        
        // Ensure manual selection/hover layers always stay on top
        if ((id.includes('selected') || id.includes('selection')) && map.current.getLayer(layerId)) {
          map.current.moveLayer(layerId);
        }
      }
    } catch (e) {
      console.warn(`Layer sync error for ${id}:`, e);
    }
  }, [mapStyle]);

  const updateGrid = React.useCallback((activeResult?: AGIDResult, selectedResult?: AGIDResult, gridSize: number = 4, refreshGrid: boolean = true) => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // If we are zoomed in enough, always use 4m grid for detail, even in sea
    let effectiveGridSize = gridSize;
    if (zoom >= 15) {
      effectiveGridSize = 4;
    }

    const sourceId = 'agid-grid';
    const activeSourceId = 'active-cell';
    const selectedSourceId = 'selected-cell';

    const shouldShow = isGridVisible && gridOpacityLevel > 0;
    const shouldShowHighlight = true;

    // Use cell bounds for active/selected cell
    const activeBounds = activeResult?.bounds;
    const selectedBounds = selectedResult?.bounds;

    const isSatellite = mapStyle === 'satellite';
    const isDark = mapStyle.includes('dark');
    const isSeaGrid = activeResult?.isSea && zoom < 15;

    // 1) Update Active Cell
    const activeData: any = (shouldShowHighlight && activeResult?.polygon) ? {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [activeResult.polygon]
      },
      properties: {}
    } : { type: 'FeatureCollection', features: [] };

    // Active Highlight (Red for Land, White/Cyan for Sea)
    ensureSourceAndLayer(activeSourceId, 'fill', activeData, {
      'fill-color': isSeaGrid ? '#ffffff' : '#ef4444', 
      'fill-opacity': isSeaGrid ? 0.35 : 0.4,
      'fill-outline-color': isSeaGrid ? '#cbd5e1' : '#dc2626'
    });

    // 2) Update Selected Cell
    const selectedData: any = (shouldShowHighlight && selectedResult?.polygon) ? {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [selectedResult.polygon]
      },
      properties: {}
    } : { type: 'FeatureCollection', features: [] };

    // Selection Fill
    ensureSourceAndLayer(selectedSourceId, 'fill', selectedData, {
      'fill-color': '#ef4444',
      'fill-opacity': 0.45,
    });

    // Selection Outline
    const selectedOutlineData: any = (shouldShowHighlight && selectedResult?.polygon) ? {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [selectedResult.polygon]
      },
      properties: {}
    } : { type: 'FeatureCollection', features: [] };

    ensureSourceAndLayer(selectedSourceId + '-outline', 'line', {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: selectedResult?.polygon || []
      },
      properties: {}
    }, {
      'line-color': '#dc2626',
      'line-width': 3,
      'line-opacity': 0.9
    });

    // 3) Restore selection indicators (glow point and label)
    const selectionPointData: any = (shouldShowHighlight && selectedResult) ? {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [selectedResult.lon, selectedResult.lat]
      },
      properties: { title: selectedResult.id }
    } : { type: 'FeatureCollection', features: [] };

    ensureSourceAndLayer('selection-point-glow', 'circle', selectionPointData, {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        15, 4,
        20, 12
      ],
      'circle-color': '#ef4444',
      'circle-opacity': 0.5,
      'circle-blur': 0.8
    });

    ensureSourceAndLayer('selection-label', 'symbol', selectionPointData, {
      'text-color': '#dc2626',
      'text-halo-color': 'rgba(255, 255, 255, 0.9)',
      'text-halo-width': 2
    }, {
      'text-field': ['get', 'title'],
      'text-font': ['Open Sans Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        15, 9,
        18, 12
      ],
      'text-offset': [0, -2],
      'text-anchor': 'bottom',
      'text-letter-spacing': 0.1
    });

    if (!shouldShow) {
      ensureSourceAndLayer(sourceId, 'line', { type: 'FeatureCollection', features: [] }, {});
      ensureSourceAndLayer('grid-cells', 'fill', { type: 'FeatureCollection', features: [] }, {});
      ensureSourceAndLayer('grid-cells-focus', 'fill', { type: 'FeatureCollection', features: [] }, {});
      return;
    }

    if (!refreshGrid) return;

    const opacityMultiplier = gridOpacityLevel / 3; 
    const gridColor = isSatellite || isDark ? '#94a3b8' : '#475569';
    
    const dynamicGridOpacity = [
      'interpolate', ['linear'], ['zoom'],
      1, 0.3 * opacityMultiplier, 
      8, 0.4 * opacityMultiplier,
      14, 0.5 * opacityMultiplier,
      18, 0.7 * opacityMultiplier,
      20, 0.8 * opacityMultiplier
    ];

    const dynamicGridWidth = [
      'interpolate', ['linear'], ['zoom'],
      1, 0.2,
      10, 0.4,
      15, 0.6,
      18, 0.8,
      20, 1.2
    ];

    if (gridWorker.current) {
      setIsGridRegenerating(true);
      const isLargeGrid = effectiveGridSize >= 1000;
      
      gridWorker.current.onmessage = (e) => {
        const { gridLines, gridCells } = e.data;
        if (!gridLines || gridLines.length === 0) {
          setIsGridRegenerating(false);
          return;
        }

        ensureSourceAndLayer(sourceId, 'line', {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'MultiLineString', coordinates: gridLines },
            properties: {}
          }]
        }, {
          'line-color': gridColor,
          'line-width': dynamicGridWidth,
          'line-opacity': dynamicGridOpacity
        });

        const cellsData = { type: 'FeatureCollection', features: gridCells };

        ensureSourceAndLayer('grid-cells', 'fill', cellsData, {
          'fill-color': isSatellite || isDark ? '#94a3b8' : '#475569', 
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            1, 0.15 * opacityMultiplier,
            10, 0.25 * opacityMultiplier,
            14, 0.35 * opacityMultiplier,
            17, 0.55 * opacityMultiplier,
            20, 0.75 * opacityMultiplier
          ]
        }, {}, ['!=', ['get', 'isFocus'], true], activeSourceId + '-layer');

        ensureSourceAndLayer('grid-cells-focus', 'fill', cellsData, {
          'fill-color': isSatellite || isDark ? '#94a3b8' : '#475569',
          'fill-opacity': 0.4 * opacityMultiplier
        }, {}, ['==', ['get', 'isFocus'], true], activeSourceId + '-layer');
        
        setIsGridRegenerating(false);
      };

      let bounds = map.current.getBounds().toArray();
      if (mapPitch > 30) {
        const sw = bounds[0];
        const ne = bounds[1];
        const lngPad = (ne[0] - sw[0]) * 0.5; 
        const latPad = (ne[1] - sw[1]) * 1.5; 
        bounds = [[sw[0] - lngPad, sw[1] - latPad * 0.2], [ne[0] + lngPad, ne[1] + latPad]];
      }

      gridWorker.current.postMessage({
        lat, lon: lng, zoom, isLargeGrid,
        bounds: bounds
      });
    }
  }, [lat, lng, zoom, mapPitch, mapStyle, isGridVisible, gridOpacityLevel, ensureSourceAndLayer]);

  const updateMapScene = React.useCallback(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const sourceId = 'nautical-regions';
    const labelLayerId = 'nautical-regions-labels';

    if (!isNauticalMode && !isSeaTypeMode) {
      ['nautical-regions-layer', 'nautical-regions-layer-land-mask', 'nautical-regions-layer-outline', labelLayerId].forEach(l => {
        if (map.current?.getLayer(l)) map.current.removeLayer(l);
      });
      if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId);
    } else {
      // Find a layer to insert before
      const layers = map.current.getStyle().layers;
      let beforeId = 'active-cell-layer';
      if (layers) {
        const firstLandLayer = layers.find(l => 
          l.id.includes('land') || l.id.includes('building') || l.id.includes('road') || 
          l.id.includes('label') || l.id.includes('poi') || l.id.includes('symbol') || 
          l.id.includes('boundary') || l.id.includes('place')
        );
        if (firstLandLayer) beforeId = firstLandLayer.id;
      }

      const features = [
        ...COUNTRY_REGIONS.flatMap(reg => {
          const coords = reg.polygon ? reg.polygon.map((p: [number, number]) => [p[1], p[0]]) : [[reg.w, reg.s], [reg.e, reg.s], [reg.e, reg.n], [reg.w, reg.n], [reg.w, reg.s]];
          return [{
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { id: reg.code, name: reg.name, isLand: true }
          }];
        }),
        ...SEA_REGIONS.flatMap(reg => {
          const polygons: any[] = [];
          if (reg.polygon) {
            polygons.push(reg.polygon.map((p: [number, number]) => [p[1], p[0]]));
          } else if (reg.w > reg.e) {
            polygons.push([[reg.w, reg.s], [180, reg.s], [180, reg.n], [reg.w, reg.n], [reg.w, reg.s]]);
            polygons.push([[-180, reg.s], [reg.e, reg.s], [reg.e, reg.n], [-180, reg.n], [-180, reg.s]]);
          } else {
            polygons.push([[reg.w, reg.s], [reg.e, reg.s], [reg.e, reg.n], [reg.w, reg.n], [reg.w, reg.s]]);
          }

          return polygons.map((coords) => ({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: {
              id: reg.id,
              name: reg.name,
              isSea: true,
              color: isSeaTypeMode 
                ? `hsl(${(reg.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 137) % 360}, 80%, 60%)`
                : `hsl(${(reg.id.split('').reduce((acc, char) => acc + char.charCodeAt(0) , 0) * 137) % 360}, 70%, 50%)`
            }
          }));
        }),
        ...LAND_REGIONS.flatMap(reg => {
          const polygons = (reg.w > reg.e) ? [
            [[reg.w, reg.s], [180, reg.s], [180, reg.n], [reg.w, reg.n], [reg.w, reg.s]],
            [[-180, reg.s], [reg.e, reg.s], [reg.e, reg.n], [-180, reg.n], [-180, reg.s]]
          ] : [
            [[reg.w, reg.s], [reg.e, reg.s], [reg.e, reg.n], [reg.w, reg.n], [reg.w, reg.s]]
          ];

          return polygons.map((coords) => ({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { id: reg.id, name: reg.name, isLand: true }
          }));
        })
      ];

      ensureSourceAndLayer(sourceId, 'fill', { type: 'FeatureCollection', features }, {
        'fill-color': ['get', 'color'],
        'fill-opacity': isSeaTypeMode ? 0.3 : 0.1,
        'fill-outline-color': ['get', 'color']
      }, {}, ['==', ['get', 'isSea'], true], beforeId);

      ensureSourceAndLayer(sourceId + '-land-mask', 'fill', { type: 'FeatureCollection', features }, {
        'fill-color': mapStyle === 'satellite' ? 'transparent' : '#f8f9fa',
        'fill-opacity': mapStyle === 'satellite' ? 0 : 1
      }, {}, ['==', ['get', 'isLand'], true], beforeId);

      ensureSourceAndLayer(sourceId + '-outline', 'line', { type: 'FeatureCollection', features }, {
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-opacity': 0.8,
        'line-dasharray': [2, 2]
      }, {
        'visibility': isSeaTypeMode ? 'visible' : 'none'
      }, ['==', ['get', 'isSea'], true], beforeId);
    }

    // --- Markers Logic ---
    const finalDestination = destination || navigationTarget;
    if (finalDestination) {
      ensureSourceAndLayer('nav-target-source', 'circle', {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [finalDestination.lng, finalDestination.lat] },
        properties: {}
      }, {
        'circle-radius': 10, 'circle-color': '#ef4444', 'circle-stroke-width': 4, 'circle-stroke-color': '#ffffff'
      });
      ensureSourceAndLayer('nav-target-dot', 'circle', {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [finalDestination.lng, finalDestination.lat] },
        properties: {}
      }, { 'circle-radius': 3, 'circle-color': '#ffffff' });
    } else {
      if (map.current?.getLayer('nav-target-source-layer')) map.current.removeLayer('nav-target-source-layer');
      if (map.current?.getLayer('nav-target-dot-layer')) map.current.removeLayer('nav-target-dot-layer');
    }

    if (origin && origin.name !== "My Location") {
      ensureSourceAndLayer('origin-source', 'circle', {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [origin.lng, origin.lat] },
        properties: {}
      }, {
        'circle-radius': 8, 'circle-color': '#3b82f6', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff'
      });
    } else {
      if (map.current?.getLayer('origin-source-layer')) map.current.removeLayer('origin-source-layer');
    }

    if (userLocation) {
      const userPoint = { type: 'Feature', geometry: { type: 'Point', coordinates: [userLocation.lng, userLocation.lat] }, properties: {} };
      ensureSourceAndLayer('user-location-halo', 'circle', userPoint, { 'circle-radius': 18, 'circle-color': '#4285F4', 'circle-opacity': 0.2 });
      ensureSourceAndLayer('user-location-layer', 'circle', userPoint, { 'circle-radius': 8, 'circle-color': '#4285F4', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' });
    } else {
      if (map.current?.getLayer('user-location-layer-layer')) map.current.removeLayer('user-location-layer-layer');
      if (map.current?.getLayer('user-location-halo-layer')) map.current.removeLayer('user-location-halo-layer');
    }

    if (routeData) {
      ensureSourceAndLayer('route-glow', 'line', routeData, { 'line-color': '#4285F4', 'line-width': 14, 'line-opacity': 0.2, 'line-blur': 4 }, { 'line-join': 'round', 'line-cap': 'round' }, ['==', ['geometry-type'], 'LineString']);
      ensureSourceAndLayer('route-casing', 'line', routeData, { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 1 }, { 'line-join': 'round', 'line-cap': 'round' }, ['==', ['geometry-type'], 'LineString']);
      ensureSourceAndLayer('route', 'line', routeData, { 'line-color': '#4285F4', 'line-width': 6, 'line-opacity': 1 }, { 'line-join': 'round', 'line-cap': 'round' }, ['==', ['geometry-type'], 'LineString']);
      ensureSourceAndLayer('route-points', 'circle', routeData, {
        'circle-radius': 6,
        'circle-color': ['match', ['get', 'type'], 'start', '#ffffff', 'end', '#EA4335', '#ffffff'],
        'circle-stroke-width': 3,
        'circle-stroke-color': ['match', ['get', 'type'], 'start', '#4285F4', 'end', '#ffffff', '#4285F4']
      }, {}, ['==', ['geometry-type'], 'Point']);
    } else {
      ['route-layer', 'route-casing-layer', 'route-glow-layer', 'route-points-layer'].forEach(l => {
        if (map.current?.getLayer(l)) map.current.removeLayer(l);
      });
    }
  }, [isNauticalMode, isSeaTypeMode, mapStyle, routeData, destination, origin, navigationTarget, userLocation, ensureSourceAndLayer]);

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ show: true, title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ show: true, title, message, onConfirm });
  };

  const jumpToAgid = React.useCallback((agidStr: string) => {
    try {
      setIsAgidPinnedToGps(false);
      const decoded = decodeAGID(agidStr);
      setLat(prev => prev !== decoded.lat ? decoded.lat : prev);
      setLng(prev => prev !== decoded.lon ? decoded.lon : prev);
      if (map.current) {
        map.current.flyTo({
          center: [decoded.lon, decoded.lat],
          zoom: getDeviceZoom(),
          pitch: mapPitch,
          essential: true
        });
      }
      setClickedAgid(prev => {
        const result = encodeAGID(decoded.lat, decoded.lon);
        if (prev && prev.id === result.id) return prev;
        return result;
      });
    } catch (e) {
      console.error("Invalid AGID JUMP:", e);
    }
  }, []);

  // --- QR Handling ---
  const saveQrCode = () => {
    if (!clickedAgid) return;
    const qrCanvas = document.getElementById('agid-qr-canvas') as HTMLCanvasElement;
    if (!qrCanvas) return;
    
    // Create a composite canvas for a "Location Card"
    const compositeCanvas = document.createElement('canvas');
    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) return;

    const padding = 40;
    const textHeight = 160;
    compositeCanvas.width = qrCanvas.width + padding * 2;
    compositeCanvas.height = qrCanvas.height + padding * 2 + textHeight;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

    // Draw QR Code
    ctx.drawImage(qrCanvas, padding, padding);

    // Text Content
    ctx.textBaseline = 'top';
    
    // Title / AGID
    ctx.fillStyle = '#2563eb'; // blue-600
    ctx.font = 'bold 36px monospace';
    ctx.fillText(`${clickedAgid.id.slice(0, 2)} ${clickedAgid.id.slice(2)}`, padding, qrCanvas.height + padding + 20);

    // Region Name
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(clickedAgid.regionName, padding, qrCanvas.height + padding + 70);

    // Coordinates
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${clickedAgid.lat.toFixed(6)}, ${clickedAgid.lon.toFixed(6)}`, padding, qrCanvas.height + padding + 105);

    // Branding / Branding Bottom
    ctx.fillStyle = '#cbd5e1'; // slate-300
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`AGID GLOBAL ADDR GRID • ${new Date().toLocaleDateString()}`, padding, qrCanvas.height + padding + 135);

    const url = compositeCanvas.toDataURL('image/png');
    
    // Save to list
    const newQr = {
      id: clickedAgid.id,
      lat: clickedAgid.lat,
      lon: clickedAgid.lon,
      address: clickedAddress,
      regionName: clickedAgid.regionName,
      savedAt: new Date().toISOString(),
      imageData: url // Store the preview or just the ID reference? Keeping reference is lighter, but image is what was requested?
    };
    
    const newSavedQrs = [newQr, ...savedQrs.filter(q => q.id !== clickedAgid.id)];
    setSavedQrs(newSavedQrs);
    localStorage.setItem('saved_qrs', JSON.stringify(newSavedQrs));

    const link = document.createElement('a');
    link.download = `AGID_CARD-${clickedAgid.id}.png`;
    link.href = url;
    link.click();
    showAlert('Saved Card', `High-quality AGID Location Card has been saved.`);
  };

  const deleteSavedQr = (id: string) => {
    const newSaved = savedQrs.filter(q => q.id !== id);
    setSavedQrs(newSaved);
    localStorage.setItem('saved_qrs', JSON.stringify(newSaved));
  };

  const SATELLITE_STYLE = {
    version: 8,
    sources: {
      's2-satellite': {
        type: 'raster',
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'],
        tileSize: 256,
        attribution: '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless - https://s2maps.eu</a> by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2020)'
      }
    },
    layers: [
      {
        id: 'satellite',
        type: 'raster',
        source: 's2-satellite',
        minzoom: 0,
        maxzoom: 14 // Sentinel-2 data is typically useful up to zoom 14/15
      }
    ]
  };

  const MAP_STYLES = [
    { id: 'bright', name: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright', icon: Globe, thumb: 'https://picsum.photos/seed/map-bright/100/100' },
    { id: 'liberty', name: 'Liberty', url: 'https://tiles.openfreemap.org/styles/liberty', icon: Layers, thumb: 'https://picsum.photos/seed/map-liberty/100/100' },
    { id: 'positron', name: 'Light', url: 'https://tiles.openfreemap.org/styles/positron', icon: Compass, thumb: 'https://picsum.photos/seed/map-light/100/100' },
    { id: 'dark', name: 'Dark', url: 'https://tiles.openfreemap.org/styles/dark', icon: Waves, thumb: 'https://picsum.photos/seed/map-dark/100/100' },
    { id: 'satellite', name: 'Satellite', url: 'satellite', icon: Globe, thumb: 'https://picsum.photos/seed/satellite-view/100/100' },
  ];

  const changeStyle = (url: string) => {
    setMapStyle(url);
    localStorage.setItem('agid_map_style', url);
    setShowStyleMenu(false);
  };

  const saveAgid = (agidData: any) => {
    const newEntry = {
      id: agidData.id,
      lat: agidData.lat,
      lon: agidData.lon,
      prefix: agidData.prefix,
      isSea: agidData.isSea,
      address: clickedAddress,
      savedAt: new Date().toISOString(),
    };
    
    const newSaved = [newEntry, ...savedAgids.filter(s => s.id !== agidData.id)];
    setSavedAgids(newSaved);
    localStorage.setItem('saved_agids', JSON.stringify(newSaved));
    setCopied('saved-' + agidData.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const deleteSavedAgid = (id: string) => {
    const newSaved = savedAgids.filter(s => s.id !== id);
    setSavedAgids(newSaved);
    localStorage.setItem('saved_agids', JSON.stringify(newSaved));
  };

  const handleShare = async () => {
    try {
      const shareData = {
        title: 'Geogrid Explorer',
        text: `Check out this location on Geogrid Explorer: ${clickedAgid?.id || 'Global Grid'}`,
        url: window.location.href,
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showAlert("Link Copied", "Share link has been copied to your clipboard.");
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const openInOsmAnd = () => {
    if (!navigationTarget) return;
    const url = `osmand://go?lat=${navigationTarget.lat}&lon=${navigationTarget.lng}&z=15`;
    window.open(url, '_blank');
  };

  const openInOrganicMaps = () => {
    if (!navigationTarget) return;
    const url = `om://map?v=1&ll=${navigationTarget.lat},${navigationTarget.lng}&n=Destination`;
    window.open(url, '_blank');
  };

  const openExternalMap = (provider: MapProvider) => {
    const dest = destination || navigationTarget;
    if (!dest) return;
    const url = GuidanceEngine.getNavigationUrl(provider, origin, dest);
    if (url) window.open(url, '_blank');
  };

  useEffect(() => {
    setSystematicTheme('all');
  }, [systematicSubCategory]);

  useEffect(() => {
    setRegionalTheme('all');
  }, [regionalType]);

  // Persistence Effects
  useEffect(() => { localStorage.setItem('agid_nautical_mode', JSON.stringify(isNauticalMode)); }, [isNauticalMode]);
  useEffect(() => { localStorage.setItem('agid_sea_type_mode', JSON.stringify(isSeaTypeMode)); }, [isSeaTypeMode]);
  useEffect(() => { localStorage.setItem('agid_coord_format', coordFormat); }, [coordFormat]);
  useEffect(() => { localStorage.setItem('agid_default_addr_tab', defaultAddrTab); }, [defaultAddrTab]);
  useEffect(() => { localStorage.setItem('agid_app_language', appLanguage); }, [appLanguage]);
  useEffect(() => { localStorage.setItem('agid_address_language', addressLanguage); }, [addressLanguage]);
  useEffect(() => { localStorage.setItem('agid_theme_mode', themeMode); }, [themeMode]);
  useEffect(() => { localStorage.setItem('agid_distance_unit', distanceUnit); }, [distanceUnit]);
  useEffect(() => { localStorage.setItem('agid_3d_enabled', JSON.stringify(is3DEnabled)); }, [is3DEnabled]);
  useEffect(() => { localStorage.setItem('agid_show_hubs', JSON.stringify(showHubs)); }, [showHubs]);
  useEffect(() => { localStorage.setItem('agid_show_flood_risk', JSON.stringify(showFloodRiskLayer)); }, [showFloodRiskLayer]);
  useEffect(() => { localStorage.setItem('agid_show_landslide_risk', JSON.stringify(showLandslideRiskLayer)); }, [showLandslideRiskLayer]);
  useEffect(() => { localStorage.setItem('agid_disaster_mode', JSON.stringify(isDisasterMode)); }, [isDisasterMode]);
  useEffect(() => { localStorage.setItem('agid_mountain_mode', JSON.stringify(isMountainMode)); }, [isMountainMode]);
  useEffect(() => { localStorage.setItem('agid_deep_sea_mode', JSON.stringify(isDeepSeaMode)); }, [isDeepSeaMode]);
  useEffect(() => { localStorage.setItem('agid_waterless_earth_mode', JSON.stringify(isWaterlessEarthMode)); }, [isWaterlessEarthMode]);
  useEffect(() => { localStorage.setItem('agid_heritage_mode', JSON.stringify(isHeritageMode)); }, [isHeritageMode]);
  useEffect(() => { localStorage.setItem('agid_gis_mode', JSON.stringify(isGisMode)); }, [isGisMode]);
  useEffect(() => { localStorage.setItem('agid_gis_layer', gisLayer); }, [gisLayer]);
  useEffect(() => { localStorage.setItem('agid_systematic_mode', JSON.stringify(isSystematicMode)); }, [isSystematicMode]);
  useEffect(() => { localStorage.setItem('agid_systematic_category', systematicCategory); }, [systematicCategory]);
  useEffect(() => { localStorage.setItem('agid_systematic_subcategory', systematicSubCategory); }, [systematicSubCategory]);
  useEffect(() => { localStorage.setItem('agid_systematic_theme', systematicTheme); }, [systematicTheme]);
  useEffect(() => { localStorage.setItem('agid_regional_mode', JSON.stringify(isRegionalMode)); }, [isRegionalMode]);
  useEffect(() => { localStorage.setItem('agid_regional_type', regionalType); }, [regionalType]);
  useEffect(() => { localStorage.setItem('agid_regional_theme', regionalTheme); }, [regionalTheme]);
  useEffect(() => { localStorage.setItem('agid_shipping_mode', JSON.stringify(isShippingMode)); }, [isShippingMode]);
  useEffect(() => { localStorage.setItem('agid_default_nav_app', defaultNavApp); }, [defaultNavApp]);
  useEffect(() => { localStorage.setItem('agid_home_agid', homeAgid); }, [homeAgid]);

  // Initialization logic for Geolocation and First Start
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const params = new URLSearchParams(window.location.search);
    if (!params.has('lat') && !params.has('lng')) {
      if ("geolocation" in navigator) {
        const getGeo = () => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              setUserLocation({ lat: latitude, lng: longitude });
              setLat(latitude);
              setLng(longitude);
              
              // Select center cell
              const result = encodeAGID(latitude, longitude);
              setClickedAgid(result);

              map.current?.flyTo({
                center: [longitude, latitude],
                zoom: getDeviceZoom(),
                pitch: mapPitch,
                essential: true,
                duration: 2500
              });
            },
            (error) => {
              console.warn("Geolocation error on start:", error);
              // Only show suggestion if permission is explicitly denied
              if (error.code === error.PERMISSION_DENIED) {
                showAlert(t('gps_suggestion_title'), t('gps_suggestion_body'));
              }
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        };

        // Check permission state first and listen for changes
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'geolocation' }).then(status => {
            const handlePermissionChange = () => {
              if (status.state === 'granted') {
                getGeo();
              }
            };
            status.addEventListener('change', handlePermissionChange);
            
            if (status.state === 'denied') {
              showAlert(t('gps_blocked_title'), t('gps_blocked_body'));
            } else {
              getGeo();
            }
          });
        } else {
          getGeo();
        }
      }
    }
  }, [isMapLoaded]);

  // Sync Map Style
  useEffect(() => {
    if (!map.current) return;
    const currentStyle = map.current.getStyle();
    // Simple check to avoid redundant setStyle
    if (mapStyle === 'satellite') {
      // Check if current style is satellite (ESRI)
      const isSatellite = currentStyle?.sources?.['esri-satellite'];
      if (!isSatellite) {
        // Only set isMapLoaded to false if it's the very first load or if we really need a full reset
        // To avoid white screen, we can skip it if map.current exists
        if (!map.current) setIsMapLoaded(false);
        map.current.setStyle(SATELLITE_STYLE as any);
      }
    } else {
      // Check if current style URL matches
      const isSatellite = currentStyle?.sources?.['esri-satellite'];
      const currentUrl = (currentStyle as any)?.metadata?.url;
      if (!currentStyle || isSatellite || currentUrl !== mapStyle) {
        if (!map.current) setIsMapLoaded(false);
        map.current.setStyle(mapStyle);
      }
    }
  }, [mapStyle]);

  // Sync Fog for Horizon Fading
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    const isSatellite = mapStyle === 'satellite';
    const isDark = mapStyle.includes('dark');
    
    try {
      (map.current as any).setFog({
        'range': [0.5, 8],
        'color': isSatellite || isDark ? '#0f172a' : '#f8fafc',
        'horizon-blend': 0.1
      });
    } catch (e) {
      // Ignore if fog not supported
    }
  }, [mapStyle, isMapLoaded]);

  useEffect(() => {
    let watchId: number | null = null;
    if (isGuidanceActive) {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation(prev => {
              if (prev && prev.lat === latitude && prev.lng === longitude) return prev;
              return { lat: latitude, lng: longitude };
            });
            
            if (map.current && isGuidanceActive) {
              map.current.flyTo({
                center: [longitude, latitude],
                zoom: 18,
                pitch: 60,
                bearing: navigationTarget ? calculateBearing(latitude, longitude, navigationTarget.lat, navigationTarget.lng) : 0,
                essential: true
              });
            }
          },
          (error) => console.error("Geolocation error:", error),
          { enableHighAccuracy: true }
        );
      }
    }
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isGuidanceActive, navigationTarget]);

  useEffect(() => {
    let watchId: number | null = null;
    if (isTracking && !isGuidanceActive) {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation(prev => {
              if (prev && prev.lat === latitude && prev.lng === longitude) return prev;
              return { lat: latitude, lng: longitude };
            });
            
            if (isAgidPinnedToGps) {
              // Once locked, we keep the SAME ID display as requested.
              // We only set it if it's currently null.
              if (!clickedAgid) {
                const result = encodeAGID(latitude, longitude);
                setClickedAgid(result);
                reverseGeocode(latitude, longitude, result.prefix, result.isSea, true);
              } else {
                // Periodically retry with high precision for the LOCKED spot if address is still vague
                // This satisfies "Attempt to get accurate address in the meantime"
                if (!clickedAddress || clickedAddress.includes("Unnamed") || clickedAddress.includes("Unknown") || clickedAddress.includes("Loading")) {
                  const { lat, lon } = decodeAGID(clickedAgid.id);
                  // Use a slightly offset lat/lng from the current actual GPS if we want the "current" address,
                  // but "locked ID" suggests we want the address of the grid cell's center or the user's specific spot at lock time.
                  // Let's use the current user position to get the best address of the current exact spot,
                  // while keeping the AGID label of the grid.
                  reverseGeocode(latitude, longitude, clickedAgid.prefix, clickedAgid.isSea, true);
                }
              }
            }
            
            if (map.current && isTracking) {
              map.current.flyTo({
                center: [longitude, latitude],
                zoom: 18,
                essential: true
              });
            }
          },
          (error) => {
            console.error("Tracking error:", error);
            setIsTracking(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, isGuidanceActive]);

  const [pulseRadius, setPulseRadius] = useState(18);

  useEffect(() => {
    if (!isGuidanceActive) return;
    
    let frame: number;
    let start: number;
    
    const animate = (time: number) => {
      if (!start) start = time;
      const progress = (time - start) % 2000;
      const radius = 18 + Math.sin((progress / 2000) * Math.PI * 2) * 4;
      setPulseRadius(radius);
      frame = requestAnimationFrame(animate);
    };
    
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isGuidanceActive]);

  useEffect(() => {
    if (map.current && map.current.getLayer('user-location-halo')) {
      map.current.setPaintProperty('user-location-halo', 'circle-radius', pulseRadius);
      map.current.setPaintProperty('user-location-halo', 'circle-opacity', 0.4 - (pulseRadius - 14) / 20);
    }
  }, [pulseRadius]);

  const calculateRoute = React.useCallback(async () => {
    const startPoint = origin || userLocation || { lat, lng };
    const endPoint = destination || navigationTarget;
    
    if (!startPoint || !endPoint) return;
    
    setIsRoutingLoading(true);
    try {
      if (useBidirectionalDijkstra) {
        console.log(`[Routing] Using Bidirectional Dijkstra (${routingMode})...`);
        const result = await RoutingService.findRoute(
          [startPoint.lat, startPoint.lng],
          [endPoint.lat, endPoint.lng],
          routingMode
        );

        if (result) {
          const next = {
            type: 'FeatureCollection' as const,
            features: [
              {
                type: 'Feature' as const,
                geometry: {
                  type: 'LineString' as const,
                  coordinates: result.path.map(n => [n.lon, n.lat])
                },
                properties: {
                  distance: result.distance / 1000,
                  duration: result.duration / 60,
                  bearing: bearing([startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]),
                  method: `Bidirectional Dijkstra (${routingMode})`,
                  mode: routingMode
                }
              },
              {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [startPoint.lng, startPoint.lat] },
                properties: { type: 'start' }
              },
              {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [endPoint.lng, endPoint.lat] },
                properties: { type: 'end' }
              }
            ]
          };
          setRouteData(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
          setIsRoutingLoading(false);
          return;
        }
      }

      // Default: OSRM Routing API via Proxy
      const profile = routingMode === 'walking' ? 'foot' : 'driving';
      const url = `/api/osrm/route?start=${startPoint.lng},${startPoint.lat}&end=${endPoint.lng},${endPoint.lat}&profile=${profile}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setRouteData(prev => {
          const next = {
            type: 'FeatureCollection' as const,
            features: [
              {
                type: 'Feature' as const,
                geometry: route.geometry,
                properties: { 
                  distance: route.distance / 1000, 
                  duration: route.duration / 60,
                  bearing: bearing([startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]),
                  method: 'OSRM'
                }
              },
              {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [startPoint.lng, startPoint.lat] },
                properties: { type: 'start' }
              },
              {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [endPoint.lng, endPoint.lat] },
                properties: { type: 'end' }
              }
            ]
          };
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
      } else {
        // Fallback to straight line if OSRM fails
        const fallback = {
          type: 'FeatureCollection' as const,
          features: [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [startPoint.lng, startPoint.lat],
                  [endPoint.lng, endPoint.lat]
                ]
              },
              properties: { 
                distance: distance([startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]),
                duration: distance([startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]) * 12,
                bearing: bearing([startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]),
                method: 'Direct'
              }
            },
            {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [startPoint.lng, startPoint.lat] },
              properties: { type: 'start' }
            },
            {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [endPoint.lng, endPoint.lat] },
              properties: { type: 'end' }
            }
          ]
        };
        setRouteData(prev => JSON.stringify(prev) === JSON.stringify(fallback) ? prev : fallback);
      }
    } catch (err) {
      console.error("Routing failed:", err);
    } finally {
      setIsRoutingLoading(false);
    }
  }, [origin, userLocation, lat, lng, destination, navigationTarget, useBidirectionalDijkstra, routingMode]);

  useEffect(() => {
    if (isNavigating && (navigationTarget || (origin && destination))) {
      calculateRoute();
    } else if (!isNavigating) {
      setRouteData(prev => prev !== null ? null : prev);
      setNavigationTarget(prev => prev !== null ? null : prev);
      setIsGuidanceActive(prev => prev !== false ? false : prev);
      setOrigin(prev => prev !== null ? null : prev);
      setDestination(prev => prev !== null ? null : prev);
    }
  }, [isNavigating, navigationTarget, userLocation, origin, destination, calculateRoute]);

  // Origin Search
  useEffect(() => {
    if (originQuery.length === 0) {
      setOriginResults([]);
      return;
    }
    
    // Add "Current Location" as a suggestion if query is "my" or similar
    const showMyLocation = "my location".includes(originQuery.toLowerCase()) || originQuery.toLowerCase().includes("current");

    const timer = setTimeout(async () => {
      setIsSearchingOrigin(true);
      try {
        const res = await fetch(`/api/photon?q=${encodeURIComponent(originQuery)}&limit=5`);
        const data = await res.json();
        let features = data.features || [];
        
        if (showMyLocation && userLocation) {
          features = [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [userLocation.lng, userLocation.lat] },
            properties: { name: "My Location", city: "Current GPS Position" }
          }, ...features];
        }
        
        setOriginResults(features);
      } catch (err) {
        console.error("Origin search error:", err);
      } finally {
        setIsSearchingOrigin(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [originQuery, userLocation]);

  // Destination Search
  useEffect(() => {
    if (destinationQuery.length === 0) {
      setDestinationResults([]);
      return;
    }

    // Add "Current Location" as a suggestion if query is "my" or similar
    const showMyLocation = "my location".includes(destinationQuery.toLowerCase()) || destinationQuery.toLowerCase().includes("current");

    const timer = setTimeout(async () => {
      setIsSearchingDestination(true);
      try {
        const res = await fetch(`/api/photon?q=${encodeURIComponent(destinationQuery)}&limit=5`);
        const data = await res.json();
        let features = data.features || [];

        if (showMyLocation && userLocation) {
          features = [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [userLocation.lng, userLocation.lat] },
            properties: { name: "My Location", city: "Current GPS Position" }
          }, ...features];
        }

        setDestinationResults(features);
      } catch (err) {
        console.error("Destination search error:", err);
      } finally {
        setIsSearchingDestination(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [destinationQuery, userLocation]);

  const selectOrigin = (feature: any) => {
    const [lng, lat] = feature.geometry.coordinates;
    const name = feature.properties.name + (feature.properties.city ? `, ${feature.properties.city}` : "");
    setOrigin({ lat, lng, name });
    setOriginQuery(name);
    setOriginResults([]);
  };

  const selectDestination = (feature: any) => {
    const [lng, lat] = feature.geometry.coordinates;
    const name = feature.properties.name + (feature.properties.city ? `, ${feature.properties.city}` : "");
    setDestination({ lat, lng, name });
    setDestinationQuery(name);
    setDestinationResults([]);
  };

  const swapOriginDestination = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
    setOriginQuery(destination?.name || "");
    setDestinationQuery(origin?.name || "");
  };

  const jumpToSaved = (saved: any) => {
    if (!map.current) return;
    map.current.flyTo({
      center: [saved.lon, saved.lat],
      zoom: getDeviceZoom(),
      pitch: mapPitch,
      essential: true,
      duration: 2000
    });
    setLat(prev => prev !== saved.lat ? saved.lat : prev);
    setLng(prev => prev !== saved.lon ? saved.lon : prev);
    const result = encodeAGID(saved.lat, saved.lon);
    setClickedAgid(result);
    setClickedAddress(saved.address || "Loading address...");
    setShowSaved(false);
  };

  const formatCoord = (val: number, isLat: boolean) => {
    if (coordFormat === 'decimal') return `${val.toFixed(5)}°`;
    
    const absVal = Math.abs(val);
    const degrees = Math.floor(absVal);
    const minutes = Math.floor((absVal - degrees) * 60);
    const seconds = ((absVal - degrees - minutes / 60) * 3600).toFixed(1);
    const direction = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareMap = () => {
    const url = `${window.location.origin}${window.location.pathname}?lat=${lat}&lng=${lng}&zoom=${zoom}`;
    copyToClipboard(url, 'share');
  };

  const fetchAddressForLang = React.useCallback(async (l: number, n: number, langCode: string, isClicked: boolean, countryCode: string = '', isHighPrecision: boolean = false) => {
    try {
      // Respect Nominatim rate limit (1 request per second) if not high-precision
      // and only if it's not a common default language to speed up UI
      const isDefaultLang = ['en', 'ja', 'zh-Hans', 'zh-Hant', 'ko'].includes(langCode);
      if (!isHighPrecision && !isDefaultLang) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
      
      const actualLangCode = langCode.startsWith('en_') ? 'en' : langCode;
      const data = await regionalReverseGeocode(l, n, actualLangCode, countryCode);
      if (data && data.address) {
        const formatted = await formatAddress(data.address, actualLangCode, { 
          shipping: isShippingMode,
          isHighPrecision,
          forceDomestic: langCode === 'en_domestic'
        });

        // Special handling for dual formats (Domestic vs International)
        const countryLangs = COUNTRY_LANGUAGES[data.address.country_code?.toLowerCase()] || [];
        const isNativeLang = countryLangs.includes(langCode);
        const isBigToSmall = BIG_TO_SMALL_COUNTRIES.includes(data.address.country_code?.toLowerCase());

        if ((langCode === 'en' && isBigToSmall) || isNativeLang) {
          const domesticVersion = await formatAddress(data.address, langCode, {
            shipping: isShippingMode,
            isHighPrecision,
            forceDomestic: true
          });
          
          if (isClicked && domesticVersion !== formatted) {
            setClickedAddressMap(prev => ({ ...prev, [`${langCode}_domestic`]: domesticVersion }));
          }
        }

        if (isClicked) {
          if (langCode === addressLanguage) {
            setClickedAddressTranslated(prev => prev !== formatted ? formatted : prev);
          } else {
            setClickedAddressMap(prev => {
              if (prev[langCode] === formatted) return prev;
              return { ...prev, [langCode]: formatted };
            });
          }
        }
      }
    } catch (e) {
      console.error(`Error fetching address for ${langCode}:`, e);
    }
  }, [formatAddress, isShippingMode, addressLanguage]);

  const lastGeocodeRequestRef = useRef<string | null>(null);

  const reverseGeocode = React.useCallback(async (l: number, n: number, prefix: string, isSeaLoc: boolean, isClicked: boolean = false) => {
    if (!l || !n) return;

    // Prevent redundant calls for the same location within 400ms grid-level debounce
    const currentKey = `${l.toFixed(6)},${n.toFixed(6)}`;
    if (lastGeocodeRequestRef.current === currentKey) return;
    lastGeocodeRequestRef.current = currentKey;

    // Helper to wait
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Determine languages based on AGID prefix and sea status
      const ALLOWED_STRICT_LANGS = [
        'ja', 'en', 'zh-Hans', 'zh-Hant', 'ko', 'fr', 'fr-SN', 'fr-CD', 'fr-CI', 
        'de', 'es', 'es-MX', 'es-AR', 'es-CL', 'es-CO', 'es-PE', 'es-VE', 'es-EC', 'es-BO', 'es-PY', 'es-UY', 'es-GQ',
        'pt-BR', 'pt-PT', 'pt-AO', 'pt-MZ', 'pt-CV', 'pt-GW', 'pt-ST', 
        'ar', 'ar-SA', 'ar-EG', 'ar-MA', 'ar-DZ', 'ar-TN', 'ar-IQ', 'ar-JO', 'ar-KW', 'ar-LB', 'ar-LY', 'ar-OM', 'ar-PS', 'ar-QA', 'ar-SD', 'ar-SY', 'ar-YE', 'ar-AE', 'ar-BH', 'ar-MR', 'ar-SO', 'ar-DJ', 'ar-KM',
        'it', 'ru'
      ];
      let langs: string[] = [];
      if (addressLanguage && addressLanguage !== 'local') {
        langs.push(addressLanguage);
      }

      if (isSeaLoc) {
        if (!langs.includes('en')) langs.push('en');
      } else {
        const cc = prefix.toLowerCase();
        const countryLangs = COUNTRY_LANGUAGES[cc] || ['en'];
        const isPrimaryEn = countryLangs[0] === 'en';

        if (isPrimaryEn) {
          // English-speaking country: Domestic vs International, plus other local langs
          langs.push('en_domestic', ...countryLangs.filter(l => l !== 'en'), 'en');
        } else {
          // Non-English primary country: Local(s) vs English
          langs.push(...countryLangs);
          if (!langs.includes('en')) langs.push('en');
        }
      }

      // Final unique filter and validation
      langs = Array.from(new Set(langs)).filter(code => 
        code === 'en_domestic' || LANGUAGES.some(lang => lang.code === code)
      );
      if (langs.length === 0) langs = ['en'];

      const primaryLang = langs[0];
      
      let data: any = null;
      try {
        const countryCode = isSeaLoc ? '' : prefix;
        data = await regionalReverseGeocode(l, n, primaryLang, countryCode);
      } catch (e) {
        console.error("Reverse geocoding fetch error:", e);
      }
      
      let langName = LANGUAGES.find(lang => lang.code === primaryLang)?.name || "Local";

      if (data && data.address) {
        const formatted = await formatAddress(data.address, primaryLang, { shipping: isShippingMode });
        const initialMap = { [primaryLang]: formatted };
        
        // Fetch nearby OSM places and update local DB
        fetchNearbyOSMPlaces(l, n, 200).then(places => {
          setNearbyPlaces(prev => {
            if (JSON.stringify(prev) === JSON.stringify(places)) return prev;
            return places;
          });
        });

        // Fetch nearest road connection
        if (isClicked) {
          fetchNearestRoad(l, n, 400).then(road => {
            setNearestRoad(prev => {
              if (JSON.stringify(prev) === JSON.stringify(road)) return prev;
              return road;
            });
          });
        }

        // Combined Context Details
        const enrichedAddressDetails = {
          ...data.address,
          elevation: data.elevation,
          delivery_difficulty: data.delivery_difficulty,
          plus_code: data.plus_code,
          flood_risk: data.flood_risk,
          mountain_name: data.mountain_name,
          landslide_risk: data.landslide_risk,
          seismic_risk: data.seismic_risk,
          land_cover: data.land_cover,
          west_asia_context: data.west_asia_context,
          russia_context: data.russia_context,
          central_asia_context: data.central_asia_context,
          south_asia_context: data.south_asia_context,
          uk_ireland_context: data.uk_ireland_context,
          nordic_context: data.nordic_context,
          european_postal_data: data.european_postal_data,
          asia_oceania_data: data.asia_oceania_data,
          oceania_context: data.oceania_context,
          east_asia_context: data.east_asia_context,
          north_america_context: data.north_america_context,
          south_america_context: data.south_america_context,
          caribbean_context: data.caribbean_context,
          central_america_context: data.central_america_context,
          southeast_asia_context: data.southeast_asia_context,
          africa_context: data.africa_context,
          us_census_data: data.us_census_data,
          official_regional_data: data.official_regional_data,
          polar_context: data.polar_context,
          polar_official_data: data.polar_official_data,
          nature_context: data.nature_context,
          sea_context: data.sea_context,
          heritage_context: data.heritage_context,
          japanese_geo_context: data.japanese_geo_context
        };

        if (isClicked) {
          setClickedAddress(prev => prev !== formatted ? formatted : prev);
          setClickedAddressLang(prev => prev !== langName ? langName : prev);
          setClickedAddressDetails(prev => {
            if (JSON.stringify(prev) === JSON.stringify(enrichedAddressDetails)) return prev;
            return enrichedAddressDetails;
          });
          setClickedActiveLangs(prev => {
            if (JSON.stringify(prev) === JSON.stringify(langs)) return prev;
            return langs;
          });
          setClickedAddressMap(prev => {
            if (JSON.stringify(prev) === JSON.stringify(initialMap)) return prev;
            return initialMap;
          });
          
          let targetTab: any = langs[0];
          if (langs.includes(defaultAddrTab)) {
            targetTab = defaultAddrTab;
          }
          setClickedAddressTab(prev => prev !== targetTab ? targetTab : prev);
          
          // Pre-fetch ALL active languages concurrently for near-instant switching
          langs.forEach(langCode => {
            if (langCode !== primaryLang) {
              fetchAddressForLang(l, n, langCode, true, isSeaLoc ? '' : prefix);
            }
          });

          // Also trigger precision translation in background if enabled
          if (addressLanguage) {
             fetchAddressForLang(l, n, addressLanguage, true, isSeaLoc ? '' : prefix, true);
          }
        }
      } else if (data && data.elevation !== undefined) {
        // Fallback if we only have elevation data
        const fallbackMsg = `Elevation: ${data.elevation}m (${data.delivery_difficulty || 'Unknown'})`;
        if (isClicked) {
          setClickedAddress(prev => prev !== fallbackMsg ? fallbackMsg : prev);
          setClickedAddressDetails(prev => {
            const next = { elevation: data.elevation, delivery_difficulty: data.delivery_difficulty };
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
          });
        }
      } else {
        // Fallback if no data
        const fallbackMsg = "Address unavailable";
        if (isClicked) {
          setClickedAddress(prev => prev !== fallbackMsg ? fallbackMsg : prev);
        }
      }
    } catch (e) {
      console.error("Reverse geocoding logic error:", e);
    }
  }, [formatAddress, defaultAddrTab, fetchAddressForLang, appLanguage]);

  useEffect(() => {
    if (clickedAgid) {
      const { lat, lon } = decodeAGID(clickedAgid.id);
      
      const timer = setTimeout(() => {
        const { lat, lon } = decodeAGID(clickedAgid.id);
        reverseGeocode(lat, lon, clickedAgid.prefix, clickedAgid.isSea, true);
        setClickedAddressTab(prev => prev !== defaultAddrTab ? defaultAddrTab : prev);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [clickedAgid?.id, defaultAddrTab, reverseGeocode]);

  const jumpToMyLocation = React.useCallback(() => {
    if (!map.current || isLocating) return;
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation(prev => {
          if (prev && prev.lat === latitude && prev.lng === longitude) return prev;
          return { lat: latitude, lng: longitude };
        });
        
        // Update center with functional updates for stability
        setLat(prev => prev !== latitude ? latitude : prev);
        setLng(prev => prev !== longitude ? longitude : prev);

        // If in route planning, set origin to my location
        if (isRoutePlanning) {
          setOrigin({ lat: latitude, lng: longitude, name: "My Location" });
          setOriginQuery("My Location");
        }
        
        // Select the cell immediately
        const result = encodeAGID(latitude, longitude);
        setClickedAgid(result);
        setClickedAddress("Loading address...");
        reverseGeocode(latitude, longitude, result.prefix, result.isSea, true);
        
        // Fetch for clicked panel specifically
        fetch(`/api/nominatim/reverse?lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`)
          .then(res => res.json())
          .then(data => {
            if (data && data.display_name) {
              setClickedAddress(prev => prev !== data.display_name ? data.display_name : prev);
            }
          });

        map.current?.flyTo({
          center: [longitude, latitude],
          zoom: getDeviceZoom(),
          pitch: mapPitch,
          essential: true,
          duration: 2000
        });
        
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        if (typeof showAlert === 'function') {
          showAlert("Location Error", "Could not get your location. Please check permissions.");
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [isLocating, isRoutePlanning, reverseGeocode]);

  const toggleTracking = () => {
    setIsTracking(prev => !prev);
    if (!isTracking) {
      jumpToMyLocation();
    }
  };

  const jumpToSelected = () => {
    if (!clickedAgid || !map.current) return;
    setIsFlying(true);
    const { minLat, maxLat, minLon, maxLon } = clickedAgid.bounds;
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    
    map.current.flyTo({
      center: [centerLon, centerLat],
      zoom: getDeviceZoom(),
      pitch: mapPitch,
      essential: true,
      duration: 1500
    });
    
    setTimeout(() => setIsFlying(false), 1500);
  };

  // Debounced search for fuzzy matching and ambiguity handling
  useEffect(() => {
    if (searchQuery.length < 2 || isSelectingResult.current) {
      if (searchQuery.length < 2) setSearchResults([]);
      isSelectingResult.current = false;
      return;
    }

    // Skip if it looks like a lat/lng or AGID
    if (searchQuery.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/) || searchQuery.match(/^[A-Z]{2,4}[A-Z2-9]{8,10}$/)) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await smartSearch(searchQuery, lat, lng);
        setSearchResults(results);
      } catch (error) {
        console.error("Smart search error:", error);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, lat, lng]);

  const selectSearchResult = async (result: any) => {
    if (!map.current) return;
    setIsAgidPinnedToGps(false);
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    const display_name = result.display_name;
    
    addToHistory(display_name);

    let agidResult = encodeAGID(newLat, newLng);
    
    isSelectingResult.current = true;
    setIsManualSelection(true);
    setClickedAgid(agidResult);
    setClickedAddress(display_name);
    setSearchQuery(display_name);
    setSearchResults([]);

    map.current.flyTo({
      center: [newLng, newLat],
      zoom: result.type === 'saved_qr' ? 19.5 : getDeviceZoom(),
      pitch: result.type === 'saved_qr' ? 0 : mapPitch,
      essential: true,
      duration: 1500
    });
  };

  const performSearch = async (query: string) => {
    if (!query.trim() || !map.current) return;

    addToHistory(query);

    setIsSearching(true);
    setSearchResults([]);
    try {
      // 1. Check Saved QRs first
      const matchedQrs = savedQrs.filter(q => 
        q.id.toLowerCase() === query.toLowerCase() || 
        (q.id.toLowerCase().includes(query.toLowerCase()) && query.length >= 4)
      );

      if (matchedQrs.length > 0 && query.length >= 4) {
        const qrResults = matchedQrs.map(q => ({
          display_name: `${q.id} - ${q.address || q.regionName}`,
          lat: q.lat.toString(),
          lon: q.lon.toString(),
          type: 'saved_qr',
          source: 'local_qrs',
          id: q.id
        }));
        setSearchResults(prev => [...qrResults, ...prev]);
        
        if (matchedQrs.some(q => q.id.toLowerCase() === query.toLowerCase())) {
          const first = matchedQrs.find(q => q.id.toLowerCase() === query.toLowerCase());
          if (first) {
            selectSearchResult({
              display_name: first.address || first.id,
              lat: first.lat.toString(),
              lon: first.lon.toString(),
              type: 'saved_qr'
            });
            setIsSearching(false);
            return;
          }
        }
      }

      // 2. Check if input is standard 12-char AGID (2 prefix + 10 hash)
      const cleanAgid = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanAgid.length === 12) {
        const decoded = decodeAGID(cleanAgid);
        if (decoded) {
          const result = encodeAGID(decoded.lat, decoded.lon);
          setIsManualSelection(true);
          setClickedAgid(result);
          setClickedAddress("Loading address...");
          
          map.current.flyTo({
            center: [decoded.lon, decoded.lat],
            zoom: 19,
            essential: true
          });
          setIsSearching(false);
          setIsSearchFocused(false);
          setSearchResults([]);
          return;
        }
      }

      // 3. Check if input is "lat, lng"
      const latLngMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
      if (latLngMatch) {
        const newLat = parseFloat(latLngMatch[1]);
        const newLng = parseFloat(latLngMatch[2]);
        
        // Select the cell
        const result = encodeAGID(newLat, newLng);
        setIsManualSelection(true);
        setClickedAgid(result);
        setClickedAddress("Loading address...");
        setClickedAddressEn("Loading address...");
        
        // Use regionalReverseGeocode instead of direct Nominatim calls
        regionalReverseGeocode(newLat, newLng, appLanguage, result.prefix).then(async data => {
          if (data && data.address) {
            setClickedAddress(await formatAddress(data.address, appLanguage));
            setClickedAddressDetails({
              ...data.address,
              elevation: data.elevation,
              delivery_difficulty: data.delivery_difficulty
            });
          }
        });
        regionalReverseGeocode(newLat, newLng, 'en', result.prefix).then(async data => {
          if (data && data.address) {
            setClickedAddressEn(await formatAddress(data.address, 'en'));
          }
        });

        map.current.flyTo({
          center: [newLng, newLat],
          zoom: 19,
          essential: true
        });
        setIsSearching(false);
        setIsSearchFocused(false);
        setSearchResults([]);
        return;
      } else {
        // Use Smart Search (Local DB + Nominatim)
        const results = await smartSearch(query, lat, lng);
        setSearchResults(results);
        
        if (results.length > 0) {
          const first = results[0];
          const newLat = parseFloat(first.lat);
          const newLng = parseFloat(first.lon);
          
          map.current.flyTo({
            center: [newLng, newLat],
            zoom: 18,
            essential: true
          });
          
          // Select it
          const result = encodeAGID(newLat, newLng);
          setIsManualSelection(true);
          setClickedAgid(result);
        } else {
          showAlert("No results found", "Try a different search term or check the spelling.");
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      showAlert("Search Error", "Error searching for location.");
    } finally {
      setIsSearching(false);
      setIsSearchFocused(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    performSearch(searchQuery);
  };

  const handleQrResult = React.useCallback((text: string) => {
    let result = text;
    let latHint: number | null = null;
    let lonHint: number | null = null;

    try {
      if (text.startsWith('http')) {
        const url = new URL(text);
        const params = new URLSearchParams(url.search);
        result = params.get('agid') || params.get('q') || text;
        
        // Extract meta hints
        const la = params.get('lat');
        const lo = params.get('lon');
        if (la && lo) {
          latHint = parseFloat(la);
          lonHint = parseFloat(lo);
        }
      }
    } catch (e) {}

    if (result.includes(':')) {
      result = result.split(':').pop() || result;
    }

    const agidMatch = result.trim().toUpperCase().match(/^[A-Z]{2,4}[A-Z2-9]{8,10}$/);
    if (agidMatch) {
      if (latHint !== null && lonHint !== null) {
        map.current?.flyTo({ center: [lonHint, latHint], zoom: 19 });
        
        // Auto-save if it has a lat/lon hint (meaning it's likely a generated card)
        const newQr = {
          id: agidMatch[0],
          lat: latHint,
          lon: lonHint,
          address: "Imported from QR",
          regionName: "Scanned",
          savedAt: new Date().toISOString()
        };
        const newSaved = [newQr, ...savedQrs.filter(q => q.id !== agidMatch[0])];
        setSavedQrs(newSaved);
        localStorage.setItem('saved_qrs', JSON.stringify(newSaved));
      }
      jumpToAgid(agidMatch[0]);
    } else {
      // General search
      setSearchQuery(result);
      performSearch(result);
    }
    setIsQrScanning(false);
  }, [jumpToAgid, performSearch, savedQrs, setSavedQrs]);

  const startQrScanner = () => {
    setIsQrScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      const onScanSuccess = (decodedText: string) => {
        scanner.clear().then(() => {
          handleQrResult(decodedText);
        });
      };
      scanner.render(onScanSuccess, () => {});
      qrScannerRef.current = scanner;
    }, 100);
  };

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const html5QrCode = new Html5Qrcode("qr-reader-hidden");
    html5QrCode.scanFile(file, true)
      .then(decodedText => {
        handleQrResult(decodedText);
      })
      .catch(() => {
        showAlert('Scan Error', 'Could not find a QR code in the selected image.');
      })
      .finally(() => {
        if (qrFileRef.current) qrFileRef.current.value = '';
      });
  };

  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear().catch(e => console.error("QR Scanner Cleanup Error:", e));
      }
    };
  }, []);

  useEffect(() => {
    if (!isQrScanning && qrScannerRef.current) {
      qrScannerRef.current.clear().catch(() => {});
      qrScannerRef.current = null;
    }
  }, [isQrScanning]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('agid_search_history');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load search history", e);
      }
    }
  }, []);

  const addToHistory = (query: string) => {
    if (!query.trim()) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(q => q !== query);
      const next = [query, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem('agid_search_history', JSON.stringify(next));
      return next;
    });
  };

  const removeFromHistory = (query: string) => {
    setSearchHistory(prev => {
      const next = prev.filter(q => q !== query);
      localStorage.setItem('agid_search_history', JSON.stringify(next));
      return next;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('search_history');
  };

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle === 'satellite' ? SATELLITE_STYLE : mapStyle,
      center: [lng, lat],
      zoom: zoom,
      pitch: mapPitch,
      bearing: mapBearing,
      attributionControl: true,
      projection: { type: projection },
      maxParallelImageRequests: 16, 
      transformRequest: (url) => ({ url })
    } as any);

    // Add ResizeObserver to handle map resizing properly
    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize();
    });
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    // Enhanced Grid Layer Refresh Logic
    const refreshGridOrder = () => {
      if (!map.current) return;
      const layers = ['grid-cells-layer', 'grid-cells-focus-layer', 'selection-point-glow-layer', 'selection-label-layer'];
      layers.forEach(layerId => {
        if (map.current?.getLayer(layerId)) {
          map.current.moveLayer(layerId);
        }
      });
    };

    // Consolidated Event Handling
    const onMapStyleLoad = () => {
      if (!map.current) return;
      console.log("Map style loaded - initializing sources and layers");
      
      // Global loaded state - strictly once
      setIsMapLoaded(true);
      setIsStyleLoading(false);

      // Re-add sources and layers because setStyle wipes them
      refreshGridOrder();

      // Set cursor to crosshair for grid mode
      try {
        map.current.getCanvas().style.cursor = 'crosshair';
      } catch (e) {
        console.warn("Could not set map cursor dynamically", e);
      }

      // Ensure Terrain DEM is always available
      if (!map.current.getSource('terrain-dem-highres')) {
        map.current.addSource('terrain-dem-highres', {
          type: 'raster-dem',
          tiles: [`${window.location.origin}/api/terrain/{z}/{x}/{y}.png`],
          encoding: 'terrarium',
          tileSize: 256,
          attribution: 'Mapzen Terrain'
        });
      }

      // Hide default map labels to focus on AGID
      const style = map.current.getStyle();
      if (style.layers) {
        style.layers.forEach(layer => {
          if (layer.type === 'symbol' && layer.layout && (layer.layout as any)['text-field']) {
            map.current?.setLayoutProperty(layer.id, 'visibility', 'none');
          }
        });
      }

      // Initial selection logic
      const center = map.current.getCenter();
      const result = encodeAGID(center.lat, center.lng);
      setClickedAgid(result);
      reverseGeocode(center.lat, center.lng, result.prefix, result.isSea, true);
    };

    map.current.on('style.load', onMapStyleLoad);
    
    map.current.on('styledata', () => {
      // Don't trigger state updates that cause re-renders if not necessary
      // setIsStyleLoading(false) here might be too frequent
    });

    map.current.on('styledataloading', () => {
      // Only set loading if it's a major change (like setStyle), not every source update
    });

    map.current.on('idle', () => {
      setIsStyleLoading(false);
      // Removed refreshGridOrder from idle to prevent potential infinite render loops
      // refreshGridOrder(); 
    });

    map.current.on('zoomend', refreshGridOrder);

    // Map Error Handling
    map.current.on('error', (e) => {
      if (e.error?.message?.includes('tiles.openfreemap.org') || e.error?.status === 0 || e.error?.status === 404) return;
      console.error("Maplibre GL Error:", e.error);
    });

    // Throttled move state updates
    let lastMoveUpdate = 0;
    map.current.on('move', () => {
      if (!map.current || isGuidanceActive || isTracking) return;
      
      const now = performance.now();
      if (now - lastMoveUpdate < 100) { // Throttle UI state updates to 10fps during pan
        // Still update the crosshair result for instant feel, but skip the expensive lat/lng state sync
        if (!isManualSelection) {
          const center = map.current.getCenter();
          const result = encodeAGID(center.lat, center.lng);
          setClickedAgid(prev => (prev?.id === result.id ? prev : result));
        }
        return; 
      }
      lastMoveUpdate = now;

      const center = map.current.getCenter();
      const newZoom = map.current.getZoom();
      const newBearing = map.current.getBearing();
      const newPitch = map.current.getPitch();

      const COORD_EPSILON = 0.000001; 
      let newLng = center.lng;
      // Normalize longitude for world wrap
      while (newLng > 180) newLng -= 360;
      while (newLng < -180) newLng += 360;
      
      const newLat = center.lat;
      const newZ = Number(newZoom.toFixed(2));
      const newB = Math.round(newBearing);
      const newP = Math.round(newPitch);
      
      setLng(prev => Math.abs(prev - newLng) > COORD_EPSILON ? newLng : prev);
      setLat(prev => Math.abs(prev - newLat) > COORD_EPSILON ? newLat : prev);
      setZoom(prev => Math.abs(prev - newZ) > 0.01 ? newZ : prev);
      setMapBearing(prev => Math.abs(prev - newB) > 0.1 ? newB : prev);
      setMapPitch(prev => Math.abs(prev - newP) > 0.1 ? newP : prev);

      const result = encodeAGID(newLat, newLng);
      if (!isManualSelection) {
        setClickedAgid(prev => (prev?.id === result.id ? prev : result));
      }
      updateGrid(result, isManualSelection ? clickedAgid || undefined : undefined, 4, false);
    });

    map.current.on('dragstart', () => {
      setIsTracking(false);
      setIsManualSelection(false); // Returning to auto-center mode on drag
    });

    let lastHoverTime = 0;
    map.current.on('mousemove', (e) => {
      if (!map.current) return;
      
      const now = performance.now();
      if (now - lastHoverTime < 50) return; // 20fps cap for grid preview for stability
      lastHoverTime = now;

      const result = encodeAGID(e.lngLat.lat, e.lngLat.lng);
      updateGrid(result, clickedAgid || undefined, 4, false);
    });

    map.current.on('click', (e) => {
      const { lat: clickLat, lng: clickLng } = e.lngLat;
      
      // Mark as manual selection so it doesn't follow center anymore
      setIsManualSelection(true);
      
      // Stop pinning to GPS if user manually selects a point
      setIsAgidPinnedToGps(false);
      setNearestRoad(null);
      
      // Check for features at click point (like POIs)
      const features = map.current?.queryRenderedFeatures(e.point);
      const poiFeature = features?.find(f => 
        f.layer.id.includes('poi') || 
        f.layer.id.includes('place') || 
        f.layer.id.includes('landmark') ||
        f.layer.id.includes('label')
      );

      if (poiFeature && poiFeature.properties?.name) {
        const name = poiFeature.properties.name;
        const result = encodeAGID(clickLat, clickLng);
        setClickedAgid(result);
        setClickedAddress(name); // Use the feature name
        setClickedAddressTab('en');
        // Pre-fill destination just in case they want directions
        setDestination({ lat: clickLat, lng: clickLng, name });
        setDestinationQuery(name);
        return;
      }

      if (isRoutePlanning) {
        setDestination({ lat: clickLat, lng: clickLng, name: `${clickLat.toFixed(4)}, ${clickLng.toFixed(4)}` });
        fetch(`/api/nominatim/reverse?lat=${clickLat}&lon=${clickLng}&zoom=18&addressdetails=1`)
          .then(res => res.json())
          .then(data => {
             const name = data.display_name || `${clickLat.toFixed(4)}, ${clickLng.toFixed(4)}`;
             setDestination({ lat: clickLat, lng: clickLng, name });
             setDestinationQuery(name);
          }).catch(() => {});
        return;
      }
      if (isNavigating) {
        setNavigationTarget({ lat: clickLat, lng: clickLng });
        return;
      }
      if (isRulerMode) {
        setRulerPoints(prev => {
          const newPoints: [number, number][] = [...prev, [clickLng, clickLat]];
          if (newPoints.length > 2) return [newPoints[newPoints.length - 1]];
          return newPoints;
        });
        return;
      }

    // Selection logic - immediate response
    const result = encodeAGID(clickLat, clickLng);
    setClickedAgid(result);
    setClickedAddress("住所を取得中...");
    setIsAgidPanelCollapsed(false);
    
    // Use consolidated logic for resolving address with pre-fetching
    reverseGeocode(clickLat, clickLng, result.prefix, result.isSea, true);
    });


    map.current.on('moveend', () => {
      if (!map.current || isGuidanceActive || isTracking) return;
      
      // If no manual selection exists, perform full geocode at final position
      if (!isManualSelection) {
        const center = map.current.getCenter();
        let newLng = center.lng;
        while (newLng > 180) newLng -= 360;
        while (newLng < -180) newLng += 360;
        const result = encodeAGID(center.lat, newLng);
        reverseGeocode(center.lat, newLng, result.prefix, result.isSea, true);
      }
    });

    return () => {
      resizeObserver.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const [prevMapStyle, setPrevMapStyle] = useState<string | null>(null);

  // Country Boundary Highlight Logic
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    
    const sourceId = 'country-boundary';
    const layerId = 'country-boundary-layer';
    
    if (!selectedCountryBoundary) {
      if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }
    
    if (!map.current.getSource(sourceId)) {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: selectedCountryBoundary
      });
      
      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#9333ea',
          'line-width': 4,
          'line-opacity': 0.8
        }
      });
    } else {
      (map.current.getSource(sourceId) as any).setData(selectedCountryBoundary);
    }
  }, [selectedCountryBoundary?.geometry, isMapLoaded, mapStyle]);

  // Region Boundary Highlight Logic
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    
    const sourceId = 'region-boundary';
    const layerId = 'region-boundary-layer';
    
    if (!selectedRegionBoundary) {
      if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }
    
    if (!map.current.getSource(sourceId)) {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: selectedRegionBoundary,
          properties: {}
        }
      });
      
      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#a855f7', // purple-500
          'line-width': 6,
          'line-opacity': 0.9,
          'line-dasharray': [2, 2]
        }
      });
    } else {
      (map.current.getSource(sourceId) as any).setData({
        type: 'Feature',
        geometry: selectedRegionBoundary,
        properties: {}
      });
    }
  }, [selectedRegionBoundary, isMapLoaded, mapStyle]);

  const handleSelectCountry = React.useCallback(async (cc: string) => {
    try {
      const res = await fetch(`/api/country-cities?cc=${cc}`);
      if (res.ok) {
        const data = await res.json();
        const resBoundary = await fetch(`/api/country-boundary?cc=${cc}`);
        if (resBoundary.ok) {
          const geojson = await resBoundary.json();
          setSelectedCountryBoundary({
            type: 'Feature',
            geometry: geojson,
            properties: {}
          });
        }
      }
    } catch (err) {
      console.error("Failed to handle country selection:", err);
    }
  }, []);

  const handlePostalCodeLabJump = React.useCallback((targetLat: number, targetLng: number, targetZoom?: number) => {
    if (map.current) {
      map.current.flyTo({
        center: [targetLng, targetLat],
        zoom: targetZoom || 12,
        essential: true
      });
    }
  }, []);

  const handlePostalCodeLabClose = React.useCallback(() => {
    setShowPostalCodeLab(false);
    setSelectedCountryBoundary(null);
  }, []);

  const fetchQualityReport = async () => {
    setIsQualityLoading(true);
    try {
      const res = await fetch('/api/data-quality/report');
      if (res.ok) {
        const data = await res.json();
        setQualityReport(data);
        setShowQualityReport(true);
      }
    } catch (e) {
      console.error('Failed to fetch quality report:', e);
    } finally {
      setIsQualityLoading(false);
    }
  };

  // Disaster Mode Logic (Auto-enable layers and change style)
  useEffect(() => {
    if (isDisasterMode) {
      if (!prevMapStyle) setPrevMapStyle(mapStyle);
      setShowFloodRiskLayer(true);
      setShowLandslideRiskLayer(true);
      setMapStyle('https://tiles.openfreemap.org/styles/dark');
    } else if (!isMountainMode && prevMapStyle) {
      setMapStyle(prevMapStyle);
      setPrevMapStyle(null);
    }
  }, [isDisasterMode]);

  // Mountain Mode Logic (Auto-enable 3D and change style)
  useEffect(() => {
    if (isMountainMode) {
      if (!prevMapStyle) setPrevMapStyle(mapStyle);
      setIs3DEnabled(true);
      setMapStyle('satellite');
    } else if (!isDisasterMode && prevMapStyle) {
      setMapStyle(prevMapStyle);
      setPrevMapStyle(null);
    }
  }, [isMountainMode]);

  // Deep Sea & Waterless Earth Mode Logic
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const gebcoSourceId = 'gebco-bathymetry';
    const gebcoLayerId = 'gebco-layer';

    if (isDeepSeaMode || isWaterlessEarthMode) {
      if (!map.current.getSource(gebcoSourceId)) {
        map.current.addSource(gebcoSourceId, {
          type: 'raster',
          tiles: [
            '/api/gebco?service=WMS&request=GetMap&layers=gebco_latest&styles=&format=image/png&transparent=true&version=1.1.1&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}'
          ],
          tileSize: 256,
          attribution: 'GEBCO Bathymetry'
        });
      }

      if (!map.current.getLayer(gebcoLayerId)) {
        map.current.addLayer({
          id: gebcoLayerId,
          type: 'raster',
          source: gebcoSourceId,
          paint: {
            'raster-opacity': isWaterlessEarthMode ? 1.0 : 0.6
          }
        }, isWaterlessEarthMode ? undefined : 'water'); // Place below water if just deep sea mode
      } else {
        map.current.setPaintProperty(gebcoLayerId, 'raster-opacity', isWaterlessEarthMode ? 1.0 : 0.6);
      }

      // If waterless earth, hide all water layers
      if (isWaterlessEarthMode) {
        const layers = map.current.getStyle().layers;
        layers.forEach(layer => {
          if (layer.id.includes('water') || layer.id.includes('sea') || layer.id.includes('ocean')) {
            if (layer.id !== gebcoLayerId) {
              map.current?.setLayoutProperty(layer.id, 'visibility', 'none');
            }
          }
        });
      } else {
        // Restore water layers if just deep sea mode
        const layers = map.current.getStyle().layers;
        layers.forEach(layer => {
          if (layer.id.includes('water') || layer.id.includes('sea') || layer.id.includes('ocean')) {
            if (layer.id !== gebcoLayerId) {
              map.current?.setLayoutProperty(layer.id, 'visibility', 'visible');
            }
          }
        });
      }
    } else {
      // Remove GEBCO if neither mode is active
      if (map.current.getLayer(gebcoLayerId)) map.current.removeLayer(gebcoLayerId);
      if (map.current.getSource(gebcoSourceId)) map.current.removeSource(gebcoSourceId);
      
      // Restore water layers
      const layers = map.current.getStyle().layers;
      layers.forEach(layer => {
        if (layer.id.includes('water') || layer.id.includes('sea') || layer.id.includes('ocean')) {
          map.current?.setLayoutProperty(layer.id, 'visibility', 'visible');
        }
      });
    }
  }, [isDeepSeaMode, isWaterlessEarthMode, isMapLoaded]);

  // Heritage Mode Logic (UNESCO Sites)
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const sourceId = 'heritage-data';
    
    if (!isHeritageMode) {
      if (map.current.getLayer(sourceId + '-unesco')) map.current.removeLayer(sourceId + '-unesco');
      if (map.current.getLayer(sourceId + '-historic')) map.current.removeLayer(sourceId + '-historic');
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    const updateHeritageData = async () => {
      if (!map.current) return;
      const bounds = map.current.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      const query = `
        [out:json][timeout:25];
        (
          node["heritage:operator"="unesco"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["heritage:operator"="unesco"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          relation["heritage:operator"="unesco"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          
          node["heritage"="2"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["heritage"="2"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          relation["heritage"="2"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});

          node["unesco_world_heritage"="yes"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["unesco_world_heritage"="yes"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          relation["unesco_world_heritage"="yes"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});

          node["historic"~"castle|fort|monument|ruins|archaeological_site"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["historic"~"castle|fort|monument|ruins|archaeological_site"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          relation["historic"~"castle|fort|monument|ruins|archaeological_site"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
        );
        out body center;
      `;

      try {
        const response = await fetch('/api/overpass', {
          method: 'POST',
          body: JSON.stringify({ query }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) return;
        const data = await response.json();

        const features: any[] = [];
        data.elements.forEach((el: any) => {
          const coords = el.type === 'node' ? [el.lon, el.lat] : [el.center.lon, el.center.lat];
          const isUnesco = el.tags['heritage:operator'] === 'unesco' || 
                          el.tags['heritage'] === '2' || 
                          el.tags['unesco_world_heritage'] === 'yes';
          
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coords },
            properties: {
              name: el.tags.name || el.tags['name:en'] || "Heritage Site",
              type: isUnesco ? 'unesco' : 'historic',
              historic: el.tags.historic
            }
          });
        });

        const geojson = { type: 'FeatureCollection', features };

        if (!map.current.getSource(sourceId)) {
          map.current.addSource(sourceId, { type: 'geojson', data: geojson as any });
          
          map.current.addLayer({
            id: sourceId + '-unesco',
            type: 'circle',
            source: sourceId,
            filter: ['==', 'type', 'unesco'],
            paint: {
              'circle-radius': 8,
              'circle-color': '#f59e0b',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff'
            }
          });

          map.current.addLayer({
            id: sourceId + '-historic',
            type: 'circle',
            source: sourceId,
            filter: ['==', 'type', 'historic'],
            paint: {
              'circle-radius': 5,
              'circle-color': '#64748b',
              'circle-stroke-width': 1,
              'circle-stroke-color': '#fff'
            }
          });
        } else {
          (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson as any);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error("Heritage data error:", err);
      }
    };

    updateHeritageData();
    map.current.on('moveend', updateHeritageData);
    return () => {
      map.current?.off('moveend', updateHeritageData);
    };
  }, [isHeritageMode, isMapLoaded]);

  // GIS Professional Mode Logic (ArcGIS Living Atlas Layers)
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const gisSourceId = 'arcgis-gis-source';
    const gisLayerId = 'arcgis-gis-layer';

    const GIS_LAYERS = {
      population: 'https://services.arcgisonline.com/ArcGIS/rest/services/Demographics/USA_Population_Density/MapServer/tile/{z}/{y}/{x}',
      landuse: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Typo/MapServer/tile/{z}/{y}/{x}',
      soil: 'https://services.arcgisonline.com/ArcGIS/rest/services/Specialty/Soil_Survey_Map/MapServer/tile/{z}/{y}/{x}'
    };

    if (isGisMode) {
      if (map.current.getLayer(gisLayerId)) map.current.removeLayer(gisLayerId);
      if (map.current.getSource(gisSourceId)) map.current.removeSource(gisSourceId);

      map.current.addSource(gisSourceId, {
        type: 'raster',
        tiles: [GIS_LAYERS[gisLayer]],
        tileSize: 256,
        attribution: 'ArcGIS Living Atlas',
        maxzoom: gisLayer === 'soil' ? 16 : 19
      });

      map.current.addLayer({
        id: gisLayerId,
        type: 'raster',
        source: gisSourceId,
        paint: { 'raster-opacity': 0.7 }
      }, 'water'); // Place below water/labels
    } else {
      if (map.current.getLayer(gisLayerId)) map.current.removeLayer(gisLayerId);
      if (map.current.getSource(gisSourceId)) map.current.removeSource(gisSourceId);
    }
  }, [isGisMode, gisLayer, isMapLoaded]);

  // Mountain Data Layer (Summits, Trails, Huts)
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const sourceId = 'mountain-data';
    
    if (!isMountainMode) {
      if (map.current.getLayer(sourceId + '-summits')) map.current.removeLayer(sourceId + '-summits');
      if (map.current.getLayer(sourceId + '-trails')) map.current.removeLayer(sourceId + '-trails');
      if (map.current.getLayer(sourceId + '-huts')) map.current.removeLayer(sourceId + '-huts');
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    const updateMountainData = async () => {
      if (!map.current) return;
      const bounds = map.current.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      const query = `
        [out:json][timeout:60];
        (
          node["natural"="peak"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["highway"~"path|footway|track"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          node["tourism"="alpine_hut"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          node["amenity"="shelter"]["shelter_type"="mountain_shelter"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          node["natural"="spring"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
        );
        out body;
        >;
        out skel qt;
      `;

      try {
        const response = await fetch('/api/overpass', {
          method: 'POST',
          body: JSON.stringify({ query }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) return;
        const data = await response.json();

        const features: any[] = [];
        const nodes: Record<number, [number, number]> = {};
        
        data.elements.forEach((el: any) => {
          if (el.type === 'node') {
            nodes[el.id] = [el.lon, el.lat];
            if (el.tags) {
              features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
                properties: {
                  name: el.tags.name || el.tags.natural || el.tags.tourism || el.tags.amenity,
                  type: el.tags.natural === 'peak' ? 'peak' : 
                        (el.tags.tourism === 'alpine_hut' || el.tags.amenity === 'shelter' ? 'hut' : 'spring'),
                  ele: el.tags.ele
                }
              });
            }
          }
        });

        data.elements.forEach((el: any) => {
          if (el.type === 'way' && el.nodes) {
            const coords = el.nodes.map((id: number) => nodes[id]).filter(Boolean);
            if (coords.length > 1) {
              features.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: {
                  name: el.tags?.name,
                  type: 'trail',
                  difficulty: el.tags?.sac_scale
                }
              });
            }
          }
        });

        const geojson: any = { type: 'FeatureCollection', features };

        if (map.current.getSource(sourceId)) {
          (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
        } else {
          map.current.addSource(sourceId, { type: 'geojson', data: geojson });
          
          // Trails Layer
          map.current.addLayer({
            id: sourceId + '-trails',
            type: 'line',
            source: sourceId,
            filter: ['==', ['get', 'type'], 'trail'],
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#d97706',
              'line-width': 2,
              'line-dasharray': [2, 1]
            }
          });

          // Summits Layer
          map.current.addLayer({
            id: sourceId + '-summits',
            type: 'circle',
            source: sourceId,
            filter: ['==', ['get', 'type'], 'peak'],
            paint: {
              'circle-radius': 6,
              'circle-color': '#ffffff',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#000000'
            }
          });

          // Huts Layer
          map.current.addLayer({
            id: sourceId + '-huts',
            type: 'circle',
            source: sourceId,
            filter: ['in', ['get', 'type'], ['literal', ['hut', 'spring']]],
            paint: {
              'circle-radius': 5,
              'circle-color': ['match', ['get', 'type'], 'hut', '#16a34a', 'spring', '#2563eb', '#ffffff'],
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff'
            }
          });

          // Click handler
          if (map.current) {
            map.current.on('click', sourceId + '-summits', (e) => {
              if (!e.features || !e.features[0]) return;
              const feature = e.features[0];
              const coordinates = (feature.geometry as any).coordinates.slice();
              const name = feature.properties?.name;
              const ele = feature.properties?.ele;

              new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                  <div style="padding: 10px; font-family: sans-serif;">
                    <h4 style="margin: 0 0 5px 0; font-weight: 900; text-transform: uppercase; font-size: 12px; color: #1e293b;">${name}</h4>
                    <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 900; background: #f1f5f9; color: #0f172a;">標高: ${ele ? ele + 'm' : '不明'}</span>
                  </div>
                `)
                .addTo(map.current as maplibregl.Map);
            });

            map.current.on('mouseenter', sourceId + '-summits', () => {
              if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current.on('mouseleave', sourceId + '-summits', () => {
              if (map.current) map.current.getCanvas().style.cursor = '';
            });
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error("Mountain data update failed:", err);
      }
    };

    const timer = setTimeout(updateMountainData, 1500);
    return () => clearTimeout(timer);
  }, [isMountainMode, lat, lng, isMapLoaded]);

  // Systematic Geography Mode Logic
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    const sourceId = 'systematic-geography';
    if (!isSystematicMode) {
      if (map.current.getLayer(sourceId + '-layer')) map.current.removeLayer(sourceId + '-layer');
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    const updateSystematicData = async () => {
      if (!map.current) return;
      const bounds = map.current.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      
      let query = '';
      const bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;

      const queries: Record<string, string> = {
        // Physical
        geomorphology: `(node["natural"~"peak|cliff|ridge|valley|volcano|cave_entrance"](${bbox});way["natural"~"peak|cliff|ridge|valley|volcano|cliff"](${bbox}););`,
        climatology: `(node["amenity"="weather_station"](${bbox});node["natural"="volcano"](${bbox}););`,
        hydrology: `(node["natural"~"spring|water|glacier"](${bbox});way["waterway"](${bbox});way["natural"~"water|wetland"](${bbox}););`,
        biogeography: `(way["natural"~"wood|scrub|heath|grassland"](${bbox});way["landuse"~"forest|grass|meadow|orchard"](${bbox}););`,
        soil: `(node["geological"~"rock|stone|outcrop"](${bbox});way["geological"~"rock|stone|outcrop"](${bbox}););`,
        disaster: `(node["emergency"~"fire_hydrant|phone|siren|defibrillator"](${bbox});node["hazard"~"flood|landslide|tsunami"](${bbox}););`,
        marine: `(node["place"~"sea|ocean|bay|strait"](${bbox});node["natural"~"coastline|beach|reef"](${bbox}););`,
        earth_system: `(node["geological"~"fault|tectonic_plate|volcano"](${bbox});way["geological"~"fault|tectonic_plate"](${bbox}););`,
        // Human
        economic: `(node["shop"](${bbox});node["amenity"~"bank|atm|marketplace"](${bbox}););`,
        urban: `(node["place"~"city|town|suburb"](${bbox});way["landuse"="residential"](${bbox}););`,
        cultural: `(node["amenity"~"place_of_worship|arts_centre|library"](${bbox});node["heritage"](${bbox}););`,
        political: `(node["boundary"="administrative"](${bbox});way["boundary"="administrative"](${bbox}););`,
        population: `(node["building"="apartments"](${bbox});way["building"="apartments"](${bbox}););`,
        transport: `(node["railway"="station"](${bbox});node["aeroway"="aerodrome"](${bbox});node["amenity"="bus_station"](${bbox}););`,
        agricultural: `(way["landuse"~"farmland|orchard|vineyard|allotments"](${bbox}););`,
        industrial: `(node["industrial"](${bbox});way["industrial"](${bbox});way["landuse"="industrial"](${bbox}););`,
        tourism: `(node["tourism"](${bbox});node["amenity"="hotel"](${bbox}););`,
      };

      query = `[out:json][timeout:60];${queries[systematicSubCategory] || queries.climatology}out center;`;

      // Refine query based on theme if selected
      if (systematicTheme !== 'all') {
        const themeFilters: Record<string, string> = {
          // Physical
          fluvial: '["waterway"~"river|stream"]',
          coastal: '["natural"~"beach|coastline"]',
          volcanic: '["natural"="volcano"]',
          karst: '["natural"="cave_entrance"]',
          precipitation: '["amenity"="weather_station"]',
          rivers: '["waterway"="river"]',
          lakes: '["natural"="water"]["water"="lake"]',
          flora: '["natural"="wood"]',
          fauna: '["natural"="scrub"]',
          flood: '["hazard"="flood"]',
          // Human
          retail: '["shop"]',
          finance: '["amenity"~"bank|atm"]',
          landuse: '["landuse"]',
          road: '["highway"]',
          rail: '["railway"]',
        };
        const filter = themeFilters[systematicTheme];
        if (filter) {
          // This is a simplified refinement. In a real app, we'd rebuild the query.
          query = query.replace(']', `]${filter}`);
        }
      }

      try {
        const response = await fetch('/api/overpass', { 
          method: 'POST', 
          body: JSON.stringify({ query }), 
          headers: { 'Content-Type': 'application/json' } 
        });
        if (!response.ok) return;
        const data = await response.json();
        const features = data.elements.map((el: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: el.type === 'node' ? [el.lon, el.lat] : [el.center.lon, el.center.lat] },
          properties: { 
            name: el.tags.name || el.tags.natural || el.tags.amenity || el.tags.landuse || el.tags.historic || 'Feature',
            type: el.tags.natural || el.tags.amenity || el.tags.landuse || el.tags.geological || 'feature',
            category: systematicCategory,
            subcategory: systematicSubCategory
          }
        }));
        const geojson: any = { type: 'FeatureCollection', features };
        if (map.current.getSource(sourceId)) {
          (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
        } else {
          map.current.addSource(sourceId, { type: 'geojson', data: geojson });
          map.current.addLayer({
            id: sourceId + '-layer',
            type: 'circle',
            source: sourceId,
            paint: { 
              'circle-radius': 9, 
              'circle-color': [
                'match', ['get', 'category'],
                'physical', '#10b981',
                'human', '#3b82f6',
                '#94a3b8'
              ], 
              'circle-stroke-width': 2, 
              'circle-stroke-color': '#ffffff' 
            }
          });

          if (map.current) {
            map.current.on('click', sourceId + '-layer', (e) => {
              if (!e.features || !e.features[0]) return;
              const feature = e.features[0];
              const coordinates = (feature.geometry as any).coordinates.slice();
              const name = feature.properties?.name;
              const type = feature.properties?.type;
              const cat = feature.properties?.category;
              const sub = feature.properties?.subcategory;
              new maplibregl.Popup().setLngLat(coordinates).setHTML(`<div style="padding:10px;font-family:sans-serif;"><h4 style="margin:0 0 5px 0;font-weight:900;text-transform:uppercase;font-size:12px;color:#1e293b;">${name}</h4><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:900;background:#f1f5f9;color:#475569;">${cat} > ${sub}</span><br/><span style="font-size:10px;color:#64748b;">Type: ${type}</span></div>`).addTo(map.current as maplibregl.Map);
            });
            map.current.on('mouseenter', sourceId + '-layer', () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
            map.current.on('mouseleave', sourceId + '-layer', () => { if (map.current) map.current.getCanvas().style.cursor = ''; });
          }
        }
      } catch (err: any) { 
        if (err.name === 'AbortError') return;
        console.error("Systematic data failed:", err); 
      }
    };
    const timer = setTimeout(updateSystematicData, 1900);
    return () => clearTimeout(timer);
  }, [isSystematicMode, systematicCategory, systematicSubCategory, systematicTheme, lat, lng, isMapLoaded]);

  // Nearest Road Visualization
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const sourceId = 'nearest-road-connection';
    
    if (!nearestRoad || !clickedAgid) {
      if (map.current.getLayer(sourceId + '-line')) map.current.removeLayer(sourceId + '-line');
      if (map.current.getLayer(sourceId + '-point')) map.current.removeLayer(sourceId + '-point');
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    const { lat, lon } = clickedAgid;
    const roadPoint = nearestRoad.point;

    const geojson: any = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[lon, lat], roadPoint]
          },
          properties: { type: 'connection' }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: roadPoint
          },
          properties: { type: 'road-point' }
        }
      ]
    };

    if (map.current.getSource(sourceId)) {
      (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      map.current.addSource(sourceId, { type: 'geojson', data: geojson });
      
      map.current.addLayer({
        id: sourceId + '-line',
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'type'], 'connection'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-dasharray': [1, 1],
          'line-opacity': 0.8
        }
      });

      map.current.addLayer({
        id: sourceId + '-point',
        type: 'circle',
        source: sourceId,
        filter: ['==', ['get', 'type'], 'road-point'],
        paint: {
          'circle-radius': 4,
          'circle-color': '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  }, [nearestRoad, clickedAgid?.id, isMapLoaded]);

  // Regional Geography Mode Logic
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    const sourceId = 'regional-geography';
    if (!isRegionalMode) {
      if (map.current.getLayer(sourceId + '-layer')) map.current.removeLayer(sourceId + '-layer');
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    const updateRegionalData = async () => {
      if (!map.current) return;
      const bounds = map.current.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
      
      let query = '';
      if (regionalType === 'static') {
        let themeFilter = '';
        if (regionalTheme === 'nature') themeFilter = '["natural"]';
        else if (regionalTheme === 'history') themeFilter = '["historic"]';
        else if (regionalTheme === 'tradition') themeFilter = '["heritage"]';
        
        query = `[out:json][timeout:60];(node${themeFilter}["historic"](${bbox});node${themeFilter}["heritage"](${bbox});node${themeFilter}["natural"="peak"](${bbox});node${themeFilter}["amenity"="museum"](${bbox}););out body;`;
      } else {
        let themeFilter = '';
        if (regionalTheme === 'urbanization') themeFilter = '["landuse"="residential"]';
        else if (regionalTheme === 'globalization') themeFilter = '["brand"]';
        
        query = `[out:json][timeout:60];(node${themeFilter}["amenity"~"marketplace|bus_station|ferry_terminal"](${bbox});node${themeFilter}["shop"~"supermarket|mall"](${bbox});node${themeFilter}["highway"="primary"](${bbox}););out center;`;
      }

      try {
        const response = await fetch('/api/overpass', { 
          method: 'POST', 
          body: JSON.stringify({ query }), 
          headers: { 'Content-Type': 'application/json' } 
        });
        if (!response.ok) return;
        const data = await response.json();
        const features = data.elements.map((el: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: el.type === 'node' ? [el.lon, el.lat] : [el.center.lon, el.center.lat] },
          properties: { 
            name: el.tags.name || el.tags.historic || el.tags.amenity || 'Regional Feature',
            type: el.tags.historic || el.tags.amenity || el.tags.tourism || el.tags.shop || 'feature',
            regionalType: regionalType
          }
        }));
        const geojson: any = { type: 'FeatureCollection', features };
        if (map.current.getSource(sourceId)) {
          (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
        } else {
          map.current.addSource(sourceId, { type: 'geojson', data: geojson });
          map.current.addLayer({
            id: sourceId + '-layer',
            type: 'circle',
            source: sourceId,
            paint: { 
              'circle-radius': 10, 
              'circle-color': regionalType === 'static' ? '#059669' : '#d946ef', 
              'circle-stroke-width': 2, 
              'circle-stroke-color': '#ffffff' 
            }
          });

          if (map.current) {
            map.current.on('click', sourceId + '-layer', (e) => {
              if (!e.features || !e.features[0]) return;
              const feature = e.features[0];
              const coordinates = (feature.geometry as any).coordinates.slice();
              const name = feature.properties?.name;
              const type = feature.properties?.type;
              const rType = feature.properties?.regionalType;
              new maplibregl.Popup().setLngLat(coordinates).setHTML(`<div style="padding:10px;font-family:sans-serif;"><h4 style="margin:0 0 5px 0;font-weight:900;text-transform:uppercase;font-size:12px;color:#1e293b;">${name}</h4><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:900;background:#f1f5f9;color:#475569;">Regional: ${rType}</span><br/><span style="font-size:10px;color:#64748b;">Type: ${type}</span></div>`).addTo(map.current as maplibregl.Map);
            });
            map.current.on('mouseenter', sourceId + '-layer', () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
            map.current.on('mouseleave', sourceId + '-layer', () => { if (map.current) map.current.getCanvas().style.cursor = ''; });
          }
        }
      } catch (err: any) { 
        if (err.name === 'AbortError') return;
        console.error("Regional data failed:", err); 
      }
    };
    const timer = setTimeout(updateRegionalData, 2000);
    return () => clearTimeout(timer);
  }, [isRegionalMode, regionalType, regionalTheme, lat, lng, isMapLoaded]);
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const sourceId = 'emergency-infra';
    
    if (!isDisasterMode) {
      if (map.current.getLayer(sourceId + '-layer')) map.current.removeLayer(sourceId + '-layer');
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    const updateEmergencyInfra = async () => {
      if (!map.current) return;
      const bounds = map.current.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      const query = `
        [out:json][timeout:60];
        (
          node["amenity"="hospital"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          node["amenity"="fire_station"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          node["amenity"="police"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          node["emergency"="shelter"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["amenity"="hospital"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
        );
        out center;
      `;

      try {
        const response = await fetch('/api/overpass', {
          method: 'POST',
          body: JSON.stringify({ query }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        const data = await response.json();

        const features = data.elements.map((el: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: el.type === 'node' ? [el.lon, el.lat] : [el.center.lon, el.center.lat]
          },
          properties: {
            name: el.tags.name || el.tags.amenity || el.tags.emergency,
            type: el.tags.amenity || el.tags.emergency
          }
        }));

        const geojson: any = { type: 'FeatureCollection', features };

        if (map.current.getSource(sourceId)) {
          (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
        } else {
          map.current.addSource(sourceId, { type: 'geojson', data: geojson });
          map.current.addLayer({
            id: sourceId + '-layer',
            type: 'circle',
            source: sourceId,
            paint: {
              'circle-radius': 8,
              'circle-color': [
                'match',
                ['get', 'type'],
                'hospital', '#ef4444',
                'fire_station', '#f97316',
                'police', '#3b82f6',
                'shelter', '#22c55e',
                '#ffffff'
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });

          if (map.current) {
            map.current.on('click', sourceId + '-layer', (e) => {
              if (!e.features || !e.features[0]) return;
              const feature = e.features[0];
              const coordinates = (feature.geometry as any).coordinates.slice();
              const name = feature.properties?.name;
              const type = feature.properties?.type;

              new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                  <div style="padding: 10px; font-family: sans-serif;">
                    <h4 style="margin: 0 0 5px 0; font-weight: 900; text-transform: uppercase; font-size: 12px; color: #1e293b;">${name}</h4>
                    <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 900; background: #f1f5f9; color: #64748b; text-transform: uppercase;">${type}</span>
                  </div>
                `)
                .addTo(map.current as maplibregl.Map);
            });

            map.current.on('mouseenter', sourceId + '-layer', () => {
              if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current.on('mouseleave', sourceId + '-layer', () => {
              if (map.current) map.current.getCanvas().style.cursor = '';
            });
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error("Emergency infra update failed:", err);
      }
    };

    const timer = setTimeout(updateEmergencyInfra, 1200);
    return () => clearTimeout(timer);
  }, [isDisasterMode, lat, lng, isMapLoaded]);

  const lastGeologicalLatLngRef = React.useRef<{lat: number, lng: number} | null>(null);

  // Geological Layers (Flood & Landslide Risk)
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const floodSourceId = 'flood-risk-layer';
    const landslideSourceId = 'landslide-risk-layer';

    const clearLayer = (id: string) => {
      if (map.current?.getLayer(id)) map.current.removeLayer(id);
      if (map.current?.getSource(id)) map.current.removeSource(id);
    };

    if (!showFloodRiskLayer) clearLayer(floodSourceId);
    if (!showLandslideRiskLayer) clearLayer(landslideSourceId);

    if (!showFloodRiskLayer && !showLandslideRiskLayer) {
      lastGeologicalLatLngRef.current = null;
      return;
    }

    // Check if we already updated nearby
    if (lastGeologicalLatLngRef.current) {
      const dist = Math.sqrt(
        Math.pow(lat - lastGeologicalLatLngRef.current.lat, 2) + 
        Math.pow(lng - lastGeologicalLatLngRef.current.lng, 2)
      );
      // Roughly 0.005 degrees is ~500m. If we haven't moved that much, skip.
      if (dist < 0.005) return;
    }

    const updateGeologicalLayers = async () => {
      if (!map.current) return;
      lastGeologicalLatLngRef.current = { lat, lng };
      const bounds = map.current.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      // Query Overpass for water and forest in the current view
      const query = `
        [out:json][timeout:25];
        (
          way["natural"="water"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["waterway"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["natural"="wetland"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["natural"="wood"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["landuse"="forest"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
        );
        out body;
        >;
        out skel qt;
      `;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetchWithRetry('/api/overpass', {
          method: 'POST',
          body: JSON.stringify({ query }),
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        }, 1, 45000);
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[Overpass] Layer update skipped: ${response.status} ${errorText}`);
          return;
        }

        let data;
        try {
          data = await response.json();
        } catch (e) {
          console.warn(`[Overpass] Failed to parse geological layer data as JSON:`, e);
          return;
        }

        if (!data || !data.elements) {
          console.warn(`[Overpass] Received empty or invalid geological data`);
          return;
        }
        
        // Convert OSM to GeoJSON (Simplified)
        const waterFeatures: any[] = [];
        const forestFeatures: any[] = [];
        
        const nodes: Record<number, [number, number]> = {};
        data.elements.filter((el: any) => el.type === 'node').forEach((el: any) => {
          nodes[el.id] = [el.lon, el.lat];
        });

        data.elements.filter((el: any) => el.type === 'way').forEach((el: any) => {
          const coords = el.nodes.map((id: number) => nodes[id]).filter(Boolean);
          if (coords.length < 3) return;
          
          const feature = {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: el.tags
          };

          if (el.tags.natural === 'water' || el.tags.waterway || el.tags.natural === 'wetland') {
            waterFeatures.push(feature);
          } else if (el.tags.natural === 'wood' || el.tags.landuse === 'forest') {
            forestFeatures.push(feature);
          }
        });

        if (showFloodRiskLayer) {
          const geojson: any = { type: 'FeatureCollection', features: waterFeatures };
          if (map.current.getSource(floodSourceId)) {
            (map.current.getSource(floodSourceId) as maplibregl.GeoJSONSource).setData(geojson);
          } else {
            map.current.addSource(floodSourceId, { type: 'geojson', data: geojson });
            map.current.addLayer({
              id: floodSourceId,
              type: 'fill',
              source: floodSourceId,
              paint: {
                'fill-color': '#3b82f6',
                'fill-opacity': 0.4,
                'fill-outline-color': '#1d4ed8'
              }
            });
          }
        }

        if (showLandslideRiskLayer) {
          const geojson: any = { type: 'FeatureCollection', features: forestFeatures };
          if (map.current.getSource(landslideSourceId)) {
            (map.current.getSource(landslideSourceId) as maplibregl.GeoJSONSource).setData(geojson);
          } else {
            map.current.addSource(landslideSourceId, { type: 'geojson', data: geojson });
            map.current.addLayer({
              id: landslideSourceId,
              type: 'fill',
              source: landslideSourceId,
              paint: {
                'fill-color': '#f59e0b',
                'fill-opacity': 0.3,
                'fill-outline-color': '#d97706'
              }
            });
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // Silence aborts
        console.error("Geological layer update failed:", err);
      }
    };

    const timer = setTimeout(updateGeologicalLayers, 2000);
    return () => clearTimeout(timer);
  }, [showFloodRiskLayer, showLandslideRiskLayer, lat, lng, isMapLoaded]);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const sourceId = 'global-hubs';
    if (!showHubs) {
      if (map.current.getLayer(sourceId + '-layer')) map.current.removeLayer(sourceId + '-layer');
      if (map.current.getLayer(sourceId + '-labels')) map.current.removeLayer(sourceId + '-labels');
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    const hubsData: any = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [121.5, 31.2] }, properties: { name: 'Port of Shanghai', type: 'port' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [103.8, 1.3] }, properties: { name: 'Port of Singapore', type: 'port' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [4.1, 51.9] }, properties: { name: 'Port of Rotterdam', type: 'port' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-118.2, 33.7] }, properties: { name: 'Port of Los Angeles', type: 'port' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [139.8, 35.5] }, properties: { name: 'Tokyo Haneda (HND)', type: 'airport' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.8, 40.6] }, properties: { name: 'New York (JFK)', type: 'airport' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-0.5, 51.5] }, properties: { name: 'London Heathrow (LHR)', type: 'airport' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [55.4, 25.3] }, properties: { name: 'Dubai (DXB)', type: 'airport' } },
      ]
    };

    if (!map.current.getSource(sourceId)) {
      map.current.addSource(sourceId, { type: 'geojson', data: hubsData });
      map.current.addLayer({
        id: sourceId + '-layer',
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 8,
          'circle-color': ['match', ['get', 'type'], 'port', '#3b82f6', 'airport', '#ef4444', '#ffffff'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
      map.current.addLayer({
        id: sourceId + '-labels',
        type: 'symbol',
        source: sourceId,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold'],
          'text-size': 10,
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1
        }
      });
    }
  }, [showHubs, isMapLoaded]);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const updateTerrain = () => {
      if (!map.current) return;
      
      if (!is3DEnabled) {
        if (map.current.getLayer('3d-buildings')) map.current.removeLayer('3d-buildings');
        try {
          map.current.setTerrain(null);
        } catch (e) {
          console.warn("Failed to reset terrain:", e);
        }
        return;
      }

      // Add Terrain if not already present
      try {
        if (!map.current.getSource('terrain-dem-highres')) {
          map.current.addSource('terrain-dem-highres', {
            type: 'raster-dem',
            tiles: [`${window.location.origin}/api/terrain/{z}/{x}/{y}.png`],
            encoding: 'terrarium',
            tileSize: 256,
            attribution: 'Mapzen Terrain'
          });
        }
        
        // Ensure style is fully loaded before setting terrain to avoid shaderPreludeCode error
        if (map.current.isStyleLoaded()) {
          map.current.setTerrain({ source: 'terrain-dem-highres', exaggeration: 1.5 });
        } else {
          map.current.once('styledata', () => {
            if (map.current && is3DEnabled) {
              map.current.setTerrain({ source: 'terrain-dem-highres', exaggeration: 1.5 });
            }
          });
        }

        // Add Atmosphere/Sky for 3D Depth (MapLibre Style)
        if (map.current.isStyleLoaded()) {
          map.current.setSky({
            'sky-color': '#334155',
            'horizon-color': '#94a3b8',
            'fog-color': '#cbd5e1',
            'horizon-fog-density': 0.8,
            'sky-opacity': 1.0
          } as any);
        }
      } catch (e) {
        console.error("Terrain setup failed:", e);
      }

      const layers = map.current.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
      )?.id;

      const hasOpenMapTiles = map.current.getSource('openmaptiles');
      if (hasOpenMapTiles && !map.current.getLayer('3d-buildings')) {
        try {
          map.current.addLayer(
            {
              'id': '3d-buildings',
              'source': 'openmaptiles',
              'source-layer': 'building',
              'type': 'fill-extrusion',
              'minzoom': 15,
              'paint': {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': ['get', 'render_height'],
                'fill-extrusion-base': ['get', 'render_min_height'],
                'fill-extrusion-opacity': 0.6
              }
            },
            labelLayerId
          );
        } catch (e) {
          console.warn("Failed to add 3D buildings layer:", e);
        }
      }
    };

    updateTerrain();
  }, [is3DEnabled, isMapLoaded, mapStyle]);


  // Grid Visibility and Style Sync
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    const center = map.current.getCenter();
    const result = encodeAGID(center.lat, center.lng);
    updateGrid(result, clickedAgid || undefined, 4, true);
  }, [zoom, mapPitch, mapBearing, isGridVisible, clickedAgid?.id, isMapLoaded, mapStyle, gridOpacityLevel]);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const sourceId = 'ruler-line';
    const pointsSourceId = 'ruler-points';

    if (rulerPoints.length === 0) {
      if (map.current.getLayer(sourceId + '-layer')) map.current.removeLayer(sourceId + '-layer');
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      if (map.current.getLayer(pointsSourceId + '-layer')) map.current.removeLayer(pointsSourceId + '-layer');
      if (map.current.getSource(pointsSourceId)) map.current.removeSource(pointsSourceId);
      return;
    }

    const lineData: any = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: rulerPoints
      }
    };

    const pointsData: any = {
      type: 'FeatureCollection',
      features: rulerPoints.map((p, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: p },
        properties: { index: i + 1 }
      }))
    };

    if (map.current.getSource(sourceId)) {
      (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(lineData);
      (map.current.getSource(pointsSourceId) as maplibregl.GeoJSONSource).setData(pointsData);
    } else {
      map.current.addSource(sourceId, { type: 'geojson', data: lineData });
      map.current.addLayer({
        id: sourceId + '-layer',
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#f59e0b',
          'line-width': 3,
          'line-dasharray': [2, 1]
        }
      });

      map.current.addSource(pointsSourceId, { type: 'geojson', data: pointsData });
      map.current.addLayer({
        id: pointsSourceId + '-layer',
        type: 'circle',
        source: pointsSourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': '#f59e0b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  }, [rulerPoints, isMapLoaded]);

  useEffect(() => {
    if (isMapLoaded) {
      updateMapScene();
    }
  }, [isNauticalMode, isSeaTypeMode, isMapLoaded, mapStyle, routeData, navigationTarget, userLocation, isGuidanceActive]);

  return (
    <div className="relative w-full h-screen font-sans bg-slate-50 text-slate-900">
      {/* Map Background */}
      <div ref={mapContainer} className="map-container" />
      
      {!isMapLoaded && (
        <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-[100]">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-600/10 border-t-blue-600 rounded-none animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Globe className="w-6 h-6 text-blue-600 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{t('app_title')}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">{appLanguage === 'ja' ? '世界のすべてに、究極の番地を。' : 'Connecting the Global Grid...'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Subtle Loading Indicators */}
      <AnimatePresence>
        {isStyleLoading && isMapLoaded && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[80] pointer-events-none"
          >
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-none shadow-2xl border border-slate-100 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-none animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                {t('loading_style')}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legal Links Footer Overlay */}
      <div className="absolute bottom-2 left-3 z-10 flex gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400/80 pointer-events-none">
        <button 
          onClick={() => { setActiveLegalDoc('privacy'); }}
          className="pointer-events-auto hover:text-slate-600 transition-colors"
        >
          {t('privacy_policy')}
        </button>
        <span className="opacity-30">•</span>
        <button 
          onClick={() => { setActiveLegalDoc('terms'); }}
          className="pointer-events-auto hover:text-slate-600 transition-colors"
        >
          {t('terms_of_service')}
        </button>
      </div>

      {/* Unified Search Sidebar */}
      <SearchSidebar 
        t={t}
        isSearchFocused={isSearchFocused}
        setIsSearchFocused={setIsSearchFocused}
        isRoutePlanning={isRoutePlanning}
        setIsRoutePlanning={setIsRoutePlanning}
        isGuidanceActive={isGuidanceActive}
        setIsGuidanceActive={setIsGuidanceActive}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        setSearchResults={setSearchResults}
        showCoordinateSearch={showCoordinateSearch}
        setShowCoordinateSearch={setShowCoordinateSearch}
        isSearching={isSearching}
        searchHistory={searchHistory}
        clearHistory={clearHistory}
        removeFromHistory={removeFromHistory}
        performSearch={performSearch}
        handleSearch={handleSearch}
        selectSearchResult={selectSearchResult}
        getCurrentMapCenter={() => {
          if (!map.current) return null;
          const center = map.current.getCenter();
          return { lat: center.lat, lng: center.lng };
        }}
        startQrScanner={startQrScanner}
        setShowMenu={setShowMenu}
        qrFileRef={qrFileRef}
        handleQrFileUpload={handleQrFileUpload}
        toggleTracking={toggleTracking}
        isTracking={isTracking}
        isLocating={isLocating}
        userLocation={userLocation}
        destination={destination}
        setDestination={setDestination}
        destinationQuery={destinationQuery}
        setDestinationQuery={setDestinationQuery}
        origin={origin}
        setOrigin={setOrigin}
        originQuery={originQuery}
        setOriginQuery={setOriginQuery}
        routeData={routeData}
        setRouteData={setRouteData}
        isNavigating={isNavigating}
        setIsNavigating={setIsNavigating}
        routingMode={routingMode}
        setRoutingMode={setRoutingMode}
        useBidirectionalDijkstra={useBidirectionalDijkstra}
        setUseBidirectionalDijkstra={setUseBidirectionalDijkstra}
        isRoutingLoading={isRoutingLoading}
        openExternalMap={openExternalMap}
        defaultNavApp={defaultNavApp}
        originResults={originResults}
        destinationResults={destinationResults}
        selectOrigin={selectOrigin}
        selectDestination={selectDestination}
        mapRef={map}
      />

      {/* Settings Screen (Full-screen transition) */}
      <SettingsPanel 
        show={showSettings}
        onClose={() => setShowSettings(false)}
        settingsTab={settingsTab}
        setSettingsTab={(t) => setSettingsTab(t as any)}
        homeAgid={homeAgid}
        setHomeAgid={setHomeAgid}
        appLanguage={appLanguage}
        setAppLanguage={setAppLanguage}
        addressLanguage={addressLanguage}
        setAddressLanguage={setAddressLanguage}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        distanceUnit={distanceUnit}
        setDistanceUnit={setDistanceUnit}
        defaultNavApp={defaultNavApp}
        setDefaultNavApp={(a) => setDefaultNavApp(a as any)}
        mapStyle={mapStyle}
        changeStyle={changeStyle}
        is3DEnabled={is3DEnabled}
        setIs3DEnabled={setIs3DEnabled}
        mapPitch={mapPitch}
        setMapPitch={setMapPitch}
        gridOpacityLevel={gridOpacityLevel}
        setGridOpacityLevel={setGridOpacityLevel}
        savedAgids={savedAgids}
        setSavedAgids={setSavedAgids}
        searchHistory={searchHistory}
        setSearchHistory={setSearchHistory}
        clearHistory={clearHistory}
        clickedAgid={clickedAgid}
        showConfirm={(title, message, onConfirm) => setConfirmConfig({ show: true, title, message, onConfirm })}
        showAlert={showAlert}
        setActiveLegalDoc={setActiveLegalDoc}
        isQualityLoading={isQualityLoading}
        fetchQualityReport={fetchQualityReport}
        registryStats={registryStats}
        setShowResources={setShowResources}
        setShowLicenses={setShowLicenses}
        mapRef={map}
        jumpToAgid={jumpToAgid}
        t={t}
      />


      {/* Side Menu Drawer */}
      <SideMenu 
        show={showMenu}
        onClose={() => setShowMenu(false)}
        setSavedTab={setSavedTab}
        setShowSaved={setShowSaved}
        setAoidModeForced={setAoidModeForced}
        setShowAddressRegistration={setShowAddressRegistration}
        setShowHistory={setShowHistory}
        setShowSettings={setShowSettings}
        setSettingsTab={(t) => setSettingsTab(t as any)}
        handleShare={handleShare}
        isSearchVisible={isSearchFocused}
        setSearchVisible={(v) => {
          setIsSearchFocused(v);
          if (v) setShowCoordinateSearch(true);
        }}
        appLanguage={appLanguage}
        setAppLanguage={setAppLanguage}
        t={t}
      />

      <div className={cn(
        "absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-[450px] px-4 flex flex-col gap-4 pointer-events-none transition-all duration-500",
        isAgidPanelCollapsed && "bottom-2"
      )}>
        {/* Selected Location Panel - Improved UX */}
        <AnimatePresence>
          {clickedAgid && (
            <GridDetailPanel 
              clickedAgid={clickedAgid}
              setClickedAgid={setClickedAgid}
              isAgidPanelCollapsed={isAgidPanelCollapsed}
              setIsAgidPanelCollapsed={setIsAgidPanelCollapsed}
              isManualSelection={isManualSelection}
              setIsManualSelection={setIsManualSelection}
              isAgidPinnedToGps={isAgidPinnedToGps}
              setIsAgidPinnedToGps={setIsAgidPinnedToGps}
              userLocation={userLocation}
              reverseGeocode={reverseGeocode}
              showAlert={showAlert}
              setIsQrVisible={setIsQrVisible}
              isQrVisible={isQrVisible}
              clickedAddress={clickedAddress}
              setDestination={setDestination}
              setDestinationQuery={setDestinationQuery}
              setIsRoutePlanning={setIsRoutePlanning}
              setIsNavigating={setIsNavigating}
              setOrigin={setOrigin}
              setOriginQuery={setOriginQuery}
              clickedAddressMap={clickedAddressMap}
              clickedAddressTab={clickedAddressTab}
              setClickedAddressTab={setClickedAddressTab}
              clickedActiveLangs={clickedActiveLangs}
              clickedAddressTranslated={clickedAddressTranslated}
              clickedAddressDetails={clickedAddressDetails}
              setClickedAddress={setClickedAddress}
              fetchAddressForLang={fetchAddressForLang}
              fastJapaneseTransliterate={fastJapaneseTransliterate}
              saveAgid={saveAgid}
              setShowLocationAnalysis={setShowLocationAnalysis}
              showLocationAnalysis={showLocationAnalysis}
              saveQrCode={saveQrCode}
              showPostalCodeLab={showPostalCodeLab}
              setShowPostalCodeLab={setShowPostalCodeLab}
              showGeoArchitect={showGeoArchitect}
              setShowGeoArchitect={setShowGeoArchitect}
              mapRef={map}
              mapPitch={mapPitch}
              getDeviceZoom={getDeviceZoom}
              encodeAGID={encodeAGID}
              copied={copied}
              setCopied={setCopied}
              t={t}
            />
          )}
        </AnimatePresence>
      </div>



      {/* Ruler Info Panel */}
      <AnimatePresence>
        {isRulerMode && rulerPoints.length > 0 && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-xl p-4 rounded-none shadow-2xl border border-amber-200 flex items-center gap-6 pointer-events-auto"
          >
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-none text-amber-600">
                <Ruler className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{t('distance')}</p>
                <p className="text-lg font-black text-slate-900 tracking-tight">
                  {rulerPoints.length === 2 
                    ? formatDistance(calculateDistance(rulerPoints[0][1], rulerPoints[0][0], rulerPoints[1][1], rulerPoints[1][0]), distanceUnit)
                    : t('select_second_point')}
                </p>
              </div>
            </div>

            {rulerPoints.length === 2 && (
              <div className="flex items-center gap-3 border-l border-slate-100 pl-6">
                <div className="bg-blue-100 p-2 rounded-none text-blue-600">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{t('bearing')}</p>
                  <p className="text-lg font-black text-slate-900 tracking-tight">
                    {calculateBearing(rulerPoints[0][1], rulerPoints[0][0], rulerPoints[1][1], rulerPoints[1][0]).toFixed(1)}°
                  </p>
                </div>
              </div>
            )}

            <button 
              onClick={() => setRulerPoints([])}
              className="ml-4 p-2 hover:bg-slate-100 rounded-none text-slate-400 hover:text-red-500 transition-colors"
              title={t('clear_points')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <MapLayersMenu 
        show={showStyleMenu}
        onClose={() => setShowStyleMenu(false)}
        mapStyle={mapStyle}
        changeStyle={changeStyle}
        mapPitch={mapPitch}
        setMapPitch={setMapPitch}
        isSystematicMode={isSystematicMode}
        setIsSystematicMode={setIsSystematicMode}
        isRegionalMode={isRegionalMode}
        setIsRegionalMode={setIsRegionalMode}
        isNauticalMode={isNauticalMode}
        setIsNauticalMode={setIsNauticalMode}
        isSeaTypeMode={isSeaTypeMode}
        setIsSeaTypeMode={setIsSeaTypeMode}
        is3DEnabled={is3DEnabled}
        setIs3DEnabled={setIs3DEnabled}
        isDisasterMode={isDisasterMode}
        setIsDisasterMode={setIsDisasterMode}
        isMountainMode={isMountainMode}
        setIsMountainMode={setIsMountainMode}
        projection={projection}
        setProjection={setProjection}
        isGridVisible={isGridVisible}
        setIsGridVisible={setIsGridVisible}
        gridOpacityLevel={gridOpacityLevel}
        setGridOpacityLevel={setGridOpacityLevel}
        mapRef={map}
      />

       <MapControls 
        clickedAgid={clickedAgid}
        isAgidPanelCollapsed={isAgidPanelCollapsed}
        mapBearing={mapBearing}
        setMapBearing={setMapBearing}
        setShowStyleMenu={setShowStyleMenu}
        toggleTracking={toggleTracking}
        isTracking={isTracking}
        isLocating={isLocating}
        mapRef={map}
        t={t}
      />

      <React.Suspense fallback={null}>
        <GeoArchitectPanel
          isOpen={showGeoArchitect}
          onClose={() => {
            setShowGeoArchitect(false);
            setSelectedRegionBoundary(null);
          }}
          onSelectRegion={setSelectedRegionBoundary}
          onDeploy={(config) => {
            console.log("Deployed Geo Logic:", config);
            // Optionally update app-wide settings here
            setGeoConfig(config);
          }}
          currentCountry={clickedAgid?.regionName || 'Global'}
          currentRegion={clickedAddressDetails?.city || clickedAddressDetails?.state}
        />
        <AddressRegistration 
          isOpen={showAddressRegistration}
          onClose={() => {
            setShowAddressRegistration(false);
            setAoidModeForced(false);
          }}
          initialAgid={clickedAgid?.id || ""}
          initialAddress={clickedAddress || ""}
          forceAoidMode={aoidModeForced}
          currentCoords={clickedAgid ? { lat: clickedAgid.lat, lon: clickedAgid.lon } : undefined}
          onRegister={(data) => {
            if (data.type === 'AOID') {
              if (aoids.length >= 3) {
                showAlert("Limit Reached", "You can only register up to 3 AOIDs. Please delete one to register a new one.");
                return;
              }
              setAoids(prev => [...prev, data]);
              showAlert("AOID Registered", `Standard ID ${data.id} has been registered as your private Address Owner ID.`);
            } else {
              console.log("Registered Address:", data);
              showAlert("Address Registered", `Address for ${data.recipient} has been saved locally.`);
            }
          }}
        />
        {showPostalCodeLab && (
          <PostalCodeLab 
            isOpen={showPostalCodeLab} 
            onClose={handlePostalCodeLabClose} 
            onJumpTo={handlePostalCodeLabJump}
            onSelectCountry={handleSelectCountry}
            currentAgid={clickedAgid?.id || ""} 
            currentAddress={clickedAddress || ""}
            lat={clickedAgid?.lat || lat}
            lng={clickedAgid?.lon || lng}
          />
        )}
      </React.Suspense>

      {/* Saved & AOID Panel */}
      <SavedLocations 
        show={showSaved}
        onClose={() => setShowSaved(false)}
        savedAgids={savedAgids}
        savedQrs={savedQrs}
        savedTab={savedTab}
        setSavedTab={setSavedTab}
        savedSearch={savedSearch}
        setSavedSearch={setSavedSearch}
        t={t}
        copyToClipboard={copyToClipboard}
        copied={copied}
        deleteSavedAgid={deleteSavedAgid}
        deleteSavedQr={deleteSavedQr}
        jumpToSaved={jumpToSaved}
        aoids={aoids}
        setAoids={setAoids}
        setShowAddressRegistration={setShowAddressRegistration}
        setLat={setLat}
        setLng={setLng}
        setZoom={setZoom}
        setShowMenu={setShowMenu}
        qrFileRef={qrFileRef}
        handleQrFileUpload={handleQrFileUpload}
        startQrScanner={startQrScanner}
      />

      {/* Side Menu (Resources) */}
      <ResourcesSideMenu 
        show={showResources} 
        onClose={() => setShowResources(false)} 
        registryStats={registryStats} 
        majorCategories={MAJOR_CATEGORIES} 
      />
      {/* Custom Alert Modal */}
      <CustomAlert config={alertConfig} onClose={() => setAlertConfig(null)} />

      <QrScannerModal 
        show={isQrScanning} 
        onClose={() => {
          qrScannerRef.current?.clear();
          setIsQrScanning(false);
        }}
        scannerId="qr-reader"
      />

      <div id="qr-reader-hidden" className="hidden" />

      {/* Center Action Button */}
      <CenterActionButton 
        show={!clickedAgid} 
        onClick={() => {
          if (!map.current) return;
          const center = map.current.getCenter();
          const lat = center.lat;
          const lng = center.lng;
          const result = encodeAGID(lat, lng);
          setClickedAgid(result);
          setClickedAddress("Loading address...");
          
          // Fetch address
          const cc = result.prefix.toLowerCase();
          const primaryLang = COUNTRY_LANGUAGES[cc]?.[0] || 'en';
          fetchAddressForLang(lat, lng, primaryLang, true, result.isSea ? '' : result.prefix);
          
          // Auto-zoom
          map.current.flyTo({
            center: [lng, lat],
            zoom: 18.5,
            pitch: 0,
            essential: true,
            duration: 1000
          });
        }} 
      />

      <LicensesOverlay show={showLicenses} onClose={() => setShowLicenses(false)} />

      <LegalOverlay activeDoc={activeLegalDoc} onClose={() => setActiveLegalDoc(null)} legalData={legalData} />

      <AnimatePresence>
        {showFullSeaRegistry && (
          <FullSeaRegistryView 
            registry={fullSeaRegistry} 
            onClose={() => setShowFullSeaRegistry(false)} 
            onSelect={(item) => {
              map.current?.flyTo({ center: [item.lon, item.lat], zoom: 12 });
              setShowFullSeaRegistry(false);
              setShowResources(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFullCountryRegistry && (
          <FullCountryRegistryView 
            registry={fullCountryRegistry} 
            onClose={() => setShowFullCountryRegistry(false)} 
            onSelect={(item) => {
              map.current?.flyTo({ center: [item.lon, item.lat], zoom: 6 });
              setShowFullCountryRegistry(false);
              setShowResources(false);
            }}
          />
        )}
      </AnimatePresence>

      <ConfirmModal 
        config={confirmConfig} 
        onClose={() => setConfirmConfig(null)} 
      />

      {/* AI Data Quality Modal */}
      <QualityReportModal 
        show={showQualityReport} 
        onClose={() => setShowQualityReport(false)} 
        qualityReport={qualityReport} 
      />
    </div>
  );
}

