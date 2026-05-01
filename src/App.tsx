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
  MapPin, 
  Map as MapIcon,
  Info, 
  Layers, 
  Search, 
  BookOpen, 
  ExternalLink, 
  Globe, 
  Grid3X3, 
  Navigation, 
  Compass, 
  RotateCcw,
  Waves, 
  Filter, 
  Bookmark, 
  Trash2, 
  X,
  Check,
  Flag,
  Copy,
  History,
  Menu,
  Settings,
  Mic,
  Share2,
  Mail,
  Eye,
  EyeOff,
  Ruler,
  Anchor,
  Plane,
  Wind,
  Box,
  Database,
  Download,
  ChevronRight,
  Home,
  Utensils,
  Plus,
  Minus,
  Smartphone,
  ShieldCheck,
  ShieldCheck as ShieldIcon,
  FileText,
  FileDown,
  ArrowLeft,
  ArrowRight,
  Mountain,
  MountainSnow,
  Scale,
  Truck,
  AlertTriangle,
  Zap,
  Leaf,
  TreeDeciduous,
  Maximize2,
  Target,
  AlertOctagon,
  LifeBuoy,
  Flame,
  Stethoscope,
  Activity,
  Droplets,
  CloudRain,
  Thermometer,
  BarChart3,
  PieChart,
  TrendingUp,
  Book,
  Landmark,
  Fish,
  Camera,
  QrCode,
  Upload,
  Clock,
  CloudSun,
  ChevronUp,
  ChevronDown,
  ChevronDown as ChevronDownIcon,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowUpDown,
  LocateFixed,
  Coffee,
  Train,
  ShoppingBag,
  Key,
  User, 
  Phone, 
  Home as HomeIcon, 
  Snowflake, 
  Waves as WavesIcon, 
  Bookmark as BookmarkIcon, 
  Trees, 
  Palmtree, 
  Ship, 
  Sun, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  MapIcon as MapIconIcon,
  Beaker,
  Settings2,
  ShieldAlert
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  LANGUAGES,
  COUNTRY_LANGUAGES,
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
import { LicensesOverlay, LegalOverlay, ConfirmModal } from './components/Overlays';
import { ExportService, ExportData } from './services/ExportService';
import { saveAs } from 'file-saver';

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const gridUpdateTimer = useRef<any>(null);
  const gridWorker = useRef<Worker | null>(null);
  const isSelectingResult = useRef(false);

  useEffect(() => {
    gridWorker.current = new Worker(new URL('./lib/gridWorker.ts', import.meta.url), { type: 'module' });
    
    // Explicitly enable grid on mount to satisfy user request
    setIsGridVisible(true);

    // Error Handling for Grid Worker
    gridWorker.current.onerror = (e) => {
      console.error("Grid Worker Error:", e);
      showAlert("計算エンジンのエラー", "高精度グリッド計算エンジンでエラーが発生しました。安定性の向上のため、ページを再読み込みすることをお勧めします。");
    };

    // Network Status Lifecycle
    const handleOffline = () => {
      showAlert("オフラインモード", "インターネット接続が切断されました。一部の地図タイルや検索機能が制限される可能性があります。");
    };
    const handleOnline = () => {
      showAlert("オンライン復旧", "インターネット接続が回復しました。地図データを再読み込みします。");
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
    if (w < 640) return 19.2; // Smartphone: ~60m diameter
    if (w < 1024) return 18.6; // Tablet: ~100m diameter
    return 18.2; // PC: ~80m radius (160m diameter)
  };

  const initialLat = parseFloat(urlParams.get('lat') || '35.6812'); // Tokyo Station
  const initialLng = parseFloat(urlParams.get('lng') || '139.7671');
  const initialZoom = parseFloat(urlParams.get('zoom') || getDeviceZoom().toString());

  const [lng, setLng] = useState(initialLng);
  const [lat, setLat] = useState(initialLat);
  const [zoom, setZoom] = useState(initialZoom);
  const [mapBearing, setMapBearing] = useState(0);
  const [mapPitch, setMapPitch] = useState(() => {
    const saved = localStorage.getItem('agid_map_pitch');
    return saved !== null ? parseInt(saved, 10) : 0;
  });
  const [gridOpacityLevel, setGridOpacityLevel] = useState(() => {
    const saved = localStorage.getItem('agid_grid_opacity_level');
    return saved !== null ? parseInt(saved, 10) : 3; // 1 to 5
  });
  const [showResources, setShowResources] = useState(false);
  const [resourceSearch, setResourceSearch] = useState("");
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [isManualSelection, setIsManualSelection] = useState(false);
  const [isNauticalMode, setIsNauticalMode] = useState(false);
  const [isSeaTypeMode, setIsSeaTypeMode] = useState(false);
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
  const [isFlying, setIsFlying] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isAgidPinnedToGps, setIsAgidPinnedToGps] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isGridRegenerating, setIsGridRegenerating] = useState(false);
  const [isStyleLoading, setIsStyleLoading] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [clickedAddressDetails, setClickedAddressDetails] = useState<any>(null);
  const [clickedAddressMap, setClickedAddressMap] = useState<Record<string, string>>({});
  const [clickedActiveLangs, setClickedActiveLangs] = useState<string[]>(['en']);
  const [settingsTab, setSettingsTab] = useState<'main' | 'home' | 'app' | 'location' | 'offline' | 'about' | 'app-language' | 'address-language' | 'help' | 'export'>('main');
  const [activeLegalDoc, setActiveLegalDoc] = useState<'privacy' | 'terms' | null>(null);
  const [showLicenses, setShowLicenses] = useState(false);
  const [clickedAddressLang, setClickedAddressLang] = useState<string>("Local");
  const [clickedAddressTab, setClickedAddressTab] = useState<string>('en');
  const [copied, setCopied] = useState<string | null>(null);
  const [savedAgids, setSavedAgids] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('saved_agids');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [homeAgid, setHomeAgid] = useState<string>(() => {
    return localStorage.getItem('agid_home_agid') || "";
  });
  const [isShippingMode, setIsShippingMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_shipping_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  // QR Scanning States
  const [isQrScanning, setIsQrScanning] = useState(false);
  const [showQrOptions, setShowQrOptions] = useState(false);
  const [isQrVisible, setIsQrVisible] = useState(false);
  const [showLocationAnalysis, setShowLocationAnalysis] = useState(false);
  const [isAgidPanelCollapsed, setIsAgidPanelCollapsed] = useState(false);
  const qrScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [savedTab, setSavedTab] = useState<'agid' | 'aoid'>('agid');
  const [showAddressRegistration, setShowAddressRegistration] = useState(false);
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
  const [defaultNavApp, setDefaultNavApp] = useState<'google' | 'apple' | 'osmand' | 'organic_maps' | 'waze'>('google');

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
      const cc = clickedAgid.id.split('-')[0];
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
      const pattern = getPatternForPrefix(clickedAgid.id.split('-')[0]) || {
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
        const hash = clickedAgid.id.split('-')[1] || '0';
        code = `${clickedAgid.id.split('-')[0]}-${parseInt(hash, 36).toString().slice(0, postalDigitCount)}`;
      } else if (postalLabStyle === 'alphanumeric') {
        code = `${clickedAgid.id.split('-')[0]}-${clickedAgid.id.split('-')[1]?.slice(0, postalDigitCount).toUpperCase()}`;
      } else {
        code = `${clickedAgid.id.split('-')[0]}·${clickedAgid.id.split('-')[1]?.slice(0, postalDigitCount).toUpperCase()}·XP`;
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
    return (localStorage.getItem('agid_coord_format') as 'decimal' | 'dms') || 'decimal';
  });
  const [defaultAddrTab, setDefaultAddrTab] = useState<'local' | 'en'>(() => {
    return (localStorage.getItem('agid_default_addr_tab') as 'local' | 'en') || 'local';
  });
  const [appLanguage, setAppLanguage] = useState<string>(() => {
    return localStorage.getItem('agid_app_language') || 'ja';
  });
  const [addressLanguage, setAddressLanguage] = useState<string>(() => {
    return localStorage.getItem('agid_address_language') || 'en';
  });

  const t = React.useCallback((key: TranslationKey) => {
    return TRANSLATIONS[appLanguage]?.[key] || TRANSLATIONS['en']?.[key] || key;
  }, [appLanguage]);
  const [showFullSeaRegistry, setShowFullSeaRegistry] = useState(false);
  const [showFullCountryRegistry, setShowFullCountryRegistry] = useState(false);
  const fullSeaRegistry = useMemo(() => generateFullSeaRegistry(), []);
  const fullCountryRegistry = useMemo(() => generateFullCountryRegistry(), []);

  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('agid_theme_mode') as 'light' | 'dark' | 'system') || 'system';
  });
  const [distanceUnit, setDistanceUnit] = useState<'automatic' | 'kilometers' | 'miles' | 'nautical'>(() => {
    return (localStorage.getItem('agid_distance_unit') as 'automatic' | 'kilometers' | 'miles' | 'nautical') || 'automatic';
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
    return (localStorage.getItem('agid_gis_layer') as any) || 'population';
  });
  const [isSystematicMode, setIsSystematicMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_systematic_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [systematicCategory, setSystematicCategory] = useState<'physical' | 'human'>(() => {
    return (localStorage.getItem('agid_systematic_category') as any) || 'physical';
  });
  const [systematicSubCategory, setSystematicSubCategory] = useState<string>(() => {
    return localStorage.getItem('agid_systematic_subcategory') || 'climatology';
  });
  const [systematicTheme, setSystematicTheme] = useState<string>(() => {
    return localStorage.getItem('agid_systematic_theme') || 'all';
  });
  const [isRegionalMode, setIsRegionalMode] = useState(() => {
    try {
      const saved = localStorage.getItem('agid_regional_mode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [regionalType, setRegionalType] = useState<'static' | 'dynamic'>(() => {
    return (localStorage.getItem('agid_regional_type') as any) || 'static';
  });
  const [regionalTheme, setRegionalTheme] = useState<string>(() => {
    return localStorage.getItem('agid_regional_theme') || 'all';
  });
  const [mapStyle, setMapStyle] = useState(() => {
    return localStorage.getItem('agid_map_style') || 'https://tiles.openfreemap.org/styles/liberty';
  });
  const [projection, setProjection] = useState<'mercator' | 'globe'>(() => {
    return (localStorage.getItem('agid_projection') as 'mercator' | 'globe') || 'mercator';
  });
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  // Custom UI for alerts and confirms
  const [alertConfig, setAlertConfig] = useState<{ show: boolean, title: string, message: string } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

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
    const link = document.createElement('a');
    link.download = `AGID_CARD-${clickedAgid.id}.png`;
    link.href = url;
    link.click();
    showAlert('Saved Card', `High-quality AGID Location Card has been saved.`);
  };

  const handleQrResult = React.useCallback((text: string) => {
    let agid = text;
    let latHint: number | null = null;
    let lonHint: number | null = null;
    let regHint: string | null = null;

    try {
      if (text.startsWith('http')) {
        const url = new URL(text);
        const params = new URLSearchParams(url.search);
        agid = params.get('agid') || text;
        
        // Extract meta hints
        const la = params.get('lat');
        const lo = params.get('lon');
        const rg = params.get('reg');
        if (la && lo) {
          latHint = parseFloat(la);
          lonHint = parseFloat(lo);
        }
        if (rg) regHint = decodeURIComponent(rg);
      }
    } catch (e) {}

    if (agid.includes(':')) {
      agid = agid.split(':').pop() || agid;
    }

    const agidMatch = agid.trim().toUpperCase().match(/^[A-Z]{2,4}[A-Z2-9]{8,10}$/);
    if (agidMatch) {
      if (latHint !== null && lonHint !== null) {
        // Instant Jump using hints
        map.current?.flyTo({ center: [lonHint, latHint], zoom: 19 });
      }
      jumpToAgid(agidMatch[0]);
      setIsQrScanning(false);
    } else {
      showAlert('Invalid QR', 'The scanned QR code does not contain a valid AGID.');
    }
  }, [jumpToAgid]);

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
  useEffect(() => { localStorage.setItem('agid_grid_visible', JSON.stringify(isGridVisible)); }, [isGridVisible]);
  useEffect(() => { localStorage.setItem('agid_coord_format', coordFormat); }, [coordFormat]);
  useEffect(() => { localStorage.setItem('agid_default_addr_tab', defaultAddrTab); }, [defaultAddrTab]);
  useEffect(() => { localStorage.setItem('agid_app_language', appLanguage); }, [appLanguage]);
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
              showAlert("GPS設定の提案", "位置情報の利用がブロックされています。地図を現在地に合わせるにはブラウザの設定から位置情報のアクセスを許可してください。");
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
      
      const data = await regionalReverseGeocode(l, n, langCode, countryCode);
      if (data && data.address) {
        const formatted = await formatAddress(data.address, langCode, { 
          shipping: isShippingMode,
          isHighPrecision 
        });
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
      let langs: string[] = [];
      if (isSeaLoc) {
        langs = ['en', appLanguage];
      } else {
        const cc = prefix.toLowerCase();
        langs = [...(COUNTRY_LANGUAGES[cc] || ['en'])];
      }

      // Always ensure English is available
      if (!langs.includes('en')) langs.push('en');
      
      // Ensure app language is available for sea
      if (isSeaLoc && !langs.includes(appLanguage)) langs.push(appLanguage);

      // Remove duplicates and filter by supported LANGUAGES
      langs = Array.from(new Set(langs)).filter(code => LANGUAGES.some(lang => lang.code === code));
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
      zoom: getDeviceZoom(),
      pitch: mapPitch,
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
      // Check if input is "lat, lng"
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
    performSearch(searchQuery);
  };

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
    localStorage.removeItem('agid_search_history');
  };

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
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
      const newLng = center.lng;
      const newLat = center.lat;
      const newZ = Number(newZoom.toFixed(2));
      const newB = Math.round(newBearing);
      const newP = Math.round(newPitch);
      
      setLng(prev => Math.abs(prev - newLng) > COORD_EPSILON ? newLng : prev);
      setLat(prev => Math.abs(prev - newLat) > COORD_EPSILON ? newLat : prev);
      setZoom(prev => Math.abs(prev - newZ) > 0.01 ? newZ : prev);
      setMapBearing(prev => Math.abs(prev - newB) > 0.1 ? newB : prev);
      setMapPitch(prev => Math.abs(prev - newP) > 0.1 ? newP : prev);

      if (!isManualSelection) {
        const result = encodeAGID(newLat, newLng);
        setClickedAgid(prev => (prev?.id === result.id ? prev : result));
      }
    });

    map.current.on('dragstart', () => {
      setIsTracking(false);
    });

    let lastHoverTime = 0;
    map.current.on('mousemove', (e) => {
      if (!map.current) return;
      
      const now = performance.now();
      if (now - lastHoverTime < 16) return; // ~60fps cap
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
        const result = encodeAGID(center.lat, center.lng);
        reverseGeocode(center.lat, center.lng, result.prefix, result.isSea, true);
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
              .addTo(map.current!);
          });

          map.current.on('mouseenter', sourceId + '-summits', () => {
            if (map.current) map.current.getCanvas().style.cursor = 'pointer';
          });
          map.current.on('mouseleave', sourceId + '-summits', () => {
            if (map.current) map.current.getCanvas().style.cursor = '';
          });
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

          map.current.on('click', sourceId + '-layer', (e) => {
            if (!e.features || !e.features[0]) return;
            const feature = e.features[0];
            const coordinates = (feature.geometry as any).coordinates.slice();
            const name = feature.properties?.name;
            const type = feature.properties?.type;
            const cat = feature.properties?.category;
            const sub = feature.properties?.subcategory;
            new maplibregl.Popup().setLngLat(coordinates).setHTML(`<div style="padding:10px;font-family:sans-serif;"><h4 style="margin:0 0 5px 0;font-weight:900;text-transform:uppercase;font-size:12px;color:#1e293b;">${name}</h4><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:900;background:#f1f5f9;color:#475569;">${cat} > ${sub}</span><br/><span style="font-size:10px;color:#64748b;">Type: ${type}</span></div>`).addTo(map.current!);
          });
          map.current.on('mouseenter', sourceId + '-layer', () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
          map.current.on('mouseleave', sourceId + '-layer', () => { if (map.current) map.current.getCanvas().style.cursor = ''; });
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

          map.current.on('click', sourceId + '-layer', (e) => {
            if (!e.features || !e.features[0]) return;
            const feature = e.features[0];
            const coordinates = (feature.geometry as any).coordinates.slice();
            const name = feature.properties?.name;
            const type = feature.properties?.type;
            const rType = feature.properties?.regionalType;
            new maplibregl.Popup().setLngLat(coordinates).setHTML(`<div style="padding:10px;font-family:sans-serif;"><h4 style="margin:0 0 5px 0;font-weight:900;text-transform:uppercase;font-size:12px;color:#1e293b;">${name}</h4><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:900;background:#f1f5f9;color:#475569;">Regional: ${rType}</span><br/><span style="font-size:10px;color:#64748b;">Type: ${type}</span></div>`).addTo(map.current!);
          });
          map.current.on('mouseenter', sourceId + '-layer', () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
          map.current.on('mouseleave', sourceId + '-layer', () => { if (map.current) map.current.getCanvas().style.cursor = ''; });
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

          // Click handler for emergency infra
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
              .addTo(map.current!);
          });

          map.current.on('mouseenter', sourceId + '-layer', () => {
            if (map.current) map.current.getCanvas().style.cursor = 'pointer';
          });
          map.current.on('mouseleave', sourceId + '-layer', () => {
            if (map.current) map.current.getCanvas().style.cursor = '';
          });
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

  const updateGrid = (activeResult?: AGIDResult, selectedResult?: AGIDResult, gridSize: number = 4, refreshGrid: boolean = true) => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // If we are zoomed in enough, always use 4m grid for detail, even in sea
    let effectiveGridSize = gridSize;
    if (zoom >= 15) {
      effectiveGridSize = 4;
    }

    const sourceId = 'agid-grid';
    const activeSourceId = 'active-cell';
    const selectedSourceId = 'selected-cell';

    // Dynamic zoom threshold based on grid size
    const isLargeGrid = effectiveGridSize >= 1000;
    const zoomThreshold = 1; // Lowered to 1 for persistent visibility

    const shouldShow = true;
    const shouldShowHighlight = true; // Always show highlight if possible

    // Use cell bounds for active/selected cell
    const activeBounds = activeResult?.bounds;
    const selectedBounds = selectedResult?.bounds;

    const isSatellite = mapStyle === 'satellite';
    const isDark = mapStyle.includes('dark');
    const isSeaGrid = activeResult?.isSea && zoom < 15;

    // Ensure sources exist, then update data
    const ensureSourceAndLayer = (id: string, type: string, data: any, paint: any, layout: any = {}, filter?: any, beforeId?: string) => {
      if (!map.current) return;
      const layerId = id + '-layer';
      const source = map.current.getSource(id) as maplibregl.GeoJSONSource;
      
      if (source) {
        source.setData(data);
        // Update paint properties
        Object.entries(paint).forEach(([key, value]) => {
          map.current?.setPaintProperty(layerId, key, value);
        });
        // Update layout properties
        Object.entries(layout).forEach(([key, value]) => {
          map.current?.setLayoutProperty(layerId, key, value);
        });
        // Update filter if provided
        if (filter !== undefined) {
          map.current?.setFilter(layerId, filter);
        }
      } else {
        map.current.addSource(id, { type: 'geojson', data });
        const layerConfig: any = {
          id: layerId,
          type: type as any,
          source: id,
          paint: paint,
          layout: layout
        };
        
        if (filter !== undefined) {
          layerConfig.filter = filter;
        }

        map.current.addLayer(layerConfig, (beforeId && map.current.getLayer(beforeId)) ? beforeId : undefined);
        
        // Force selection to top ONLY on creation
        if ((id.includes('selected') || id.includes('selection')) && map.current.getLayer(layerId)) {
          map.current.moveLayer(layerId);
        }
      }
    };

    // 1) Update Active Cell
    const activeData: any = (shouldShowHighlight && activeResult?.polygon) ? {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [activeResult.polygon]
      },
      properties: {}
    } : { type: 'FeatureCollection', features: [] };

    ensureSourceAndLayer(activeSourceId, 'fill', activeData, {
      'fill-color': isSeaGrid ? '#ffffff' : '#3b82f6', // Use blue highlight
      'fill-opacity': isSeaGrid ? 0.35 : 0.3,
      'fill-outline-color': isSeaGrid ? '#cbd5e1' : '#2563eb'
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
      'fill-color': '#3b82f6',
      'fill-opacity': 0.45,
    });

    // Selection Outline
    const selectedOutlineData: any = (shouldShowHighlight && selectedResult?.polygon) ? {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: selectedResult.polygon
      },
      properties: {}
    } : { type: 'FeatureCollection', features: [] };

    ensureSourceAndLayer(selectedSourceId + '-outline', 'line', selectedOutlineData, {
      'line-color': '#2563eb',
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
      'circle-color': '#3b82f6',
      'circle-opacity': 0.4,
      'circle-blur': 0.8
    });

    ensureSourceAndLayer('selection-label', 'symbol', selectionPointData, {
      'text-color': '#1e40af',
      'text-halo-color': 'rgba(255, 255, 255, 0.8)',
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

    const opacityMultiplier = gridOpacityLevel / 3; 
    const gridColor = isSatellite || isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(203, 213, 225, 0.8)'; // Subtle white-grey (slate-300ish)
    
    // Smooth interpolation for grid width and opacity based on zoom
    // Refined for a professional and subtle look across all zoom levels
    const dynamicGridOpacity = [
      'interpolate',
      ['linear'],
      ['zoom'],
      1, 0.05 * opacityMultiplier, 
      8, 0.1 * opacityMultiplier,
      14, 0.25 * opacityMultiplier,
      18, 0.45 * opacityMultiplier,
      20, 0.6 * opacityMultiplier
    ];

    const dynamicGridWidth = [
      'interpolate',
      ['linear'],
      ['zoom'],
      1, 0.02,
      10, 0.08,
      15, 0.15,
      18, 0.35,
      20, 0.5
    ];

    if (shouldShow && refreshGrid) {
      if (gridWorker.current) {
        setIsGridRegenerating(true);
        gridWorker.current.onmessage = (e) => {
          const { gridLines, gridCells } = e.data;
          
          if (!gridLines || gridLines.length === 0) {
            setIsGridRegenerating(false);
            return;
          }

          const gridData = {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'MultiLineString', coordinates: gridLines },
              properties: {}
            }]
          };

          const cellsData = {
            type: 'FeatureCollection',
            features: gridCells
          };

          ensureSourceAndLayer(sourceId, 'line', gridData, {
            'line-color': gridColor,
            'line-width': dynamicGridWidth,
            'line-opacity': dynamicGridOpacity
          });

          // General Grid Cells (non-focus area)
          ensureSourceAndLayer('grid-cells', 'fill', cellsData, {
            'fill-color': isSatellite || isDark ? '#ffffff' : '#94a3b8',
            'fill-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              1, 0,
              14, 0.05 * opacityMultiplier,
              17, 0.12 * opacityMultiplier,
              20, 0.2 * opacityMultiplier
            ]
          }, {}, ['!=', ['get', 'isFocus'], true], activeSourceId + '-layer');

          // Focus Grid Cells (300m radius, always visible)
          ensureSourceAndLayer('grid-cells-focus', 'fill', cellsData, {
            'fill-color': isSatellite || isDark ? '#ffffff' : '#94a3b8',
            'fill-opacity': 0.15 * opacityMultiplier
          }, {}, ['==', ['get', 'isFocus'], true], activeSourceId + '-layer');
          
          const labelLayerId = 'grid-labels-layer';
          if (map.current!.getLayer(labelLayerId)) {
            map.current!.removeLayer(labelLayerId);
            map.current!.removeSource(labelLayerId);
          }

          // Order adjustment (Bottom to Top): Grid Cells -> Grid Lines -> Highlights
          if (map.current!.getLayer('grid-cells-layer')) map.current!.moveLayer('grid-cells-layer');
          if (map.current!.getLayer('grid-cells-focus-layer')) map.current!.moveLayer('grid-cells-focus-layer');
          if (map.current!.getLayer(sourceId + '-layer')) map.current!.moveLayer(sourceId + '-layer');
          
          // Highlights ALWAYS on very top
          if (map.current!.getLayer(activeSourceId + '-layer')) map.current!.moveLayer(activeSourceId + '-layer');
          if (map.current!.getLayer(selectedSourceId + '-layer')) map.current!.moveLayer(selectedSourceId + '-layer');
          if (map.current!.getLayer(selectedSourceId + '-outline-layer')) map.current!.moveLayer(selectedSourceId + '-outline-layer');
          if (map.current!.getLayer('selection-point-glow-layer')) map.current!.moveLayer('selection-point-glow-layer');
          if (map.current!.getLayer('selection-label-layer')) map.current!.moveLayer('selection-label-layer');
          
          setIsGridRegenerating(false);
        };

        let bounds = map.current?.getBounds().toArray();
        
        // Expand bounds significantly for tilted views to cover horizon
        if (bounds && mapPitch > 30) {
          const sw = bounds[0];
          const ne = bounds[1];
          const lngPad = (ne[0] - sw[0]) * 0.8; 
          const latPad = (ne[1] - sw[1]) * 3.5; 
          bounds = [
            [sw[0] - lngPad, sw[1] - latPad * 0.4], 
            [ne[0] + lngPad, ne[1] + latPad]      
          ];
        }

        gridWorker.current.postMessage({
          lat, lon: lng, zoom, isLargeGrid,
          bounds: bounds
        });
      }
    } else {
      ensureSourceAndLayer(sourceId, 'line', { type: 'FeatureCollection', features: [] }, {});
      ensureSourceAndLayer('grid-cells', 'fill', { type: 'FeatureCollection', features: [] }, {});
      ensureSourceAndLayer('grid-cells-focus', 'fill', { type: 'FeatureCollection', features: [] }, {});
    }
  };

  const updateNauticalLayer = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const sourceId = 'nautical-regions';
    const layerId = 'nautical-regions-layer';
    const labelLayerId = 'nautical-regions-labels';

    // Find a layer to insert before (usually before roads/labels)
    const layers = map.current.getStyle().layers;
    let beforeId = 'active-cell-layer';
    if (layers) {
      const firstLandLayer = layers.find(l => 
        l.id.includes('land') || 
        l.id.includes('building') || 
        l.id.includes('road') || 
        l.id.includes('label') ||
        l.id.includes('poi') ||
        l.id.includes('symbol') ||
        l.id.includes('boundary') ||
        l.id.includes('place')
      );
      if (firstLandLayer) beforeId = firstLandLayer.id;
    }

    if (!isNauticalMode && !isSeaTypeMode) {
      if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
      if (map.current.getLayer(layerId + '-land-mask')) map.current.removeLayer(layerId + '-land-mask');
      if (map.current.getLayer(layerId + '-outline')) map.current.removeLayer(layerId + '-outline');
      if (map.current.getLayer(labelLayerId)) map.current.removeLayer(labelLayerId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    const landPolygons = [
      ...COUNTRY_REGIONS.flatMap(reg => {
        if (reg.polygon) return [polygon([reg.polygon.map(p => [p[1], p[0]])])];
        return [bboxPolygon([reg.w, reg.s, reg.e, reg.n])];
      }),
      ...LAND_REGIONS.flatMap(reg => {
        if (reg.w > reg.e) {
          return [
            bboxPolygon([reg.w, reg.s, 180, reg.n]),
            bboxPolygon([-180, reg.s, reg.e, reg.n])
          ];
        }
        return [bboxPolygon([reg.w, reg.s, reg.e, reg.n])];
      })
    ];

    const features = [
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

        return polygons.map((coords) => {
          let seaFeat: any = polygon([coords]);
          
          // Subtract land from sea
          if (isSeaTypeMode && landPolygons.length > 0) {
            try {
              // In Turf v7, difference accepts a FeatureCollection where the first feature is the base
              // and subsequent features are subtracted.
              const diff = difference(featureCollection([seaFeat, ...landPolygons]));
              if (diff) seaFeat = diff;
              else return null;
            } catch (e) {
              console.warn("Turf difference error:", e);
            }
          }

          const areaValue = area(seaFeat);
          
          return {
            ...seaFeat,
            properties: {
              id: reg.id,
              name: reg.name,
              isSea: true,
              area: areaValue,
              color: isSeaTypeMode 
                ? `hsl(${(reg.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 137) % 360}, 80%, 60%)`
                : `hsl(${(reg.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 137) % 360}, 70%, 50%)`
            }
          };
        }).filter(f => f !== null);
      }),
      ...COUNTRY_REGIONS.flatMap(reg => {
        const polygons: any[] = [];
        if (reg.polygon) {
          const coords = reg.polygon.map((p: [number, number]) => [p[1], p[0]]);
          polygons.push(coords);
        } else {
          polygons.push([[reg.w, reg.s], [reg.e, reg.s], [reg.e, reg.n], [reg.w, reg.n], [reg.w, reg.s]]);
        }

        return polygons.map((coords) => ({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: {
            id: reg.code,
            name: reg.name,
            isLand: true
          }
        }));
      }),
      ...LAND_REGIONS.flatMap(reg => {
        const polygons: any[] = [];
        if (reg.w > reg.e) {
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
            isLand: true
          }
        }));
      })
    ];

    const data: any = {
      type: 'FeatureCollection',
      features
    };

    if (map.current.getSource(sourceId)) {
      (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
      
      // Update land mask color if it exists
      if (map.current.getLayer(layerId + '-land-mask')) {
        map.current.setPaintProperty(layerId + '-land-mask', 'fill-color', mapStyle === 'satellite' ? 'transparent' : '#f8f9fa');
        map.current.setPaintProperty(layerId + '-land-mask', 'fill-opacity', mapStyle === 'satellite' ? 0 : 1);
      }
      
      // Update sea layer opacity based on mode
      if (map.current.getLayer(layerId)) {
        map.current.setPaintProperty(layerId, 'fill-opacity', isSeaTypeMode ? 0.3 : 0.1);
        map.current.setPaintProperty(layerId, 'fill-color', ['get', 'color']);
      }

      // Navigation Target Marker
      const finalDestination = destination || navigationTarget;
      if (finalDestination) {
        const targetPoint = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [finalDestination.lng, finalDestination.lat] },
          properties: {}
        };
        if (map.current.getSource('nav-target-source')) {
          (map.current.getSource('nav-target-source') as maplibregl.GeoJSONSource).setData(targetPoint as any);
        } else {
          map.current.addSource('nav-target-source', {
            type: 'geojson',
            data: targetPoint as any
          });
          map.current.addLayer({
            id: 'nav-target-layer',
            type: 'circle',
            source: 'nav-target-source',
            paint: {
              'circle-radius': 10,
              'circle-color': '#ef4444',
              'circle-stroke-width': 4,
              'circle-stroke-color': '#ffffff'
            }
          }, beforeId);
          // Add a small white dot in the center for a "pin" look
          map.current.addLayer({
            id: 'nav-target-dot',
            type: 'circle',
            source: 'nav-target-source',
            paint: {
              'circle-radius': 3,
              'circle-color': '#ffffff'
            }
          }, beforeId);
        }
      } else {
        if (map.current.getLayer('nav-target-layer')) map.current.removeLayer('nav-target-layer');
        if (map.current.getLayer('nav-target-dot')) map.current.removeLayer('nav-target-dot');
        if (map.current.getSource('nav-target-source')) map.current.removeSource('nav-target-source');
      }

      // Origin Marker (if not user location)
      if (origin && origin.name !== "My Location") {
        const originPoint = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [origin.lng, origin.lat] },
          properties: {}
        };
        if (map.current.getSource('origin-source')) {
          (map.current.getSource('origin-source') as maplibregl.GeoJSONSource).setData(originPoint as any);
        } else {
          map.current.addSource('origin-source', {
            type: 'geojson',
            data: originPoint as any
          });
          map.current.addLayer({
            id: 'origin-layer',
            type: 'circle',
            source: 'origin-source',
            paint: {
              'circle-radius': 8,
              'circle-color': '#3b82f6',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff'
            }
          }, beforeId);
        }
      } else {
        if (map.current.getLayer('origin-layer')) map.current.removeLayer('origin-layer');
        if (map.current.getSource('origin-source')) map.current.removeSource('origin-source');
      }

      // User Location Marker
      if (userLocation) {
        const userPoint = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [userLocation.lng, userLocation.lat] },
          properties: {}
        };
        if (map.current.getSource('user-location-source')) {
          (map.current.getSource('user-location-source') as maplibregl.GeoJSONSource).setData(userPoint as any);
        } else {
          map.current.addSource('user-location-source', {
            type: 'geojson',
            data: userPoint as any
          });
          // User Location Halo (Pulsing effect look)
          map.current.addLayer({
            id: 'user-location-halo',
            type: 'circle',
            source: 'user-location-source',
            paint: {
              'circle-radius': 18,
              'circle-color': '#4285F4',
              'circle-opacity': 0.2
            }
          }, beforeId);
          // User Location Main Dot
          map.current.addLayer({
            id: 'user-location-layer',
            type: 'circle',
            source: 'user-location-source',
            paint: {
              'circle-radius': 8,
              'circle-color': '#4285F4',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff'
            }
          }, beforeId);
        }
      } else {
        if (map.current.getLayer('user-location-layer')) map.current.removeLayer('user-location-layer');
        if (map.current.getLayer('user-location-halo')) map.current.removeLayer('user-location-halo');
        if (map.current.getSource('user-location-source')) map.current.removeSource('user-location-source');
      }

      // Navigation Route Layer
      if (routeData) {
        if (map.current.getSource('route-source')) {
          (map.current.getSource('route-source') as maplibregl.GeoJSONSource).setData(routeData);
        } else {
          map.current.addSource('route-source', {
            type: 'geojson',
            data: routeData
          });
          
          // Route Glow (Soft shadow)
          map.current.addLayer({
            id: 'route-layer-glow',
            type: 'line',
            source: 'route-source',
            filter: ['==', ['geometry-type'], 'LineString'],
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#4285F4',
              'line-width': 14,
              'line-opacity': 0.2,
              'line-blur': 4
            }
          }, beforeId);

          // Route Casing (White border)
          map.current.addLayer({
            id: 'route-layer-casing',
            type: 'line',
            source: 'route-source',
            filter: ['==', ['geometry-type'], 'LineString'],
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#ffffff',
              'line-width': 10,
              'line-opacity': 1
            }
          }, beforeId);

          // Main Route Line (Google Maps Blue)
          map.current.addLayer({
            id: 'route-layer',
            type: 'line',
            source: 'route-source',
            filter: ['==', ['geometry-type'], 'LineString'],
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#4285F4',
              'line-width': 6,
              'line-opacity': 1
            }
          }, beforeId);

          // Route Start/End Points
          map.current.addLayer({
            id: 'route-points',
            type: 'circle',
            source: 'route-source',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': 6,
              'circle-color': ['match', ['get', 'type'], 'start', '#ffffff', 'end', '#EA4335', '#ffffff'],
              'circle-stroke-width': 3,
              'circle-stroke-color': ['match', ['get', 'type'], 'start', '#4285F4', 'end', '#ffffff', '#4285F4']
            }
          }, beforeId);
        }
      } else {
        if (map.current.getLayer('route-points')) map.current.removeLayer('route-points');
        if (map.current.getLayer('route-layer')) map.current.removeLayer('route-layer');
        if (map.current.getLayer('route-layer-casing')) map.current.removeLayer('route-layer-casing');
        if (map.current.getLayer('route-layer-glow')) map.current.removeLayer('route-layer-glow');
        if (map.current.getSource('route-source')) map.current.removeSource('route-source');
      }
    } else {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data
      });

      // Sea Layer
      map.current.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        filter: ['==', ['get', 'isSea'], true],
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': isSeaTypeMode ? 0.3 : 0.1,
          'fill-outline-color': ['get', 'color']
        }
      }, beforeId);

      // Land Mask Layer (to hide sea color on land)
      map.current.addLayer({
        id: layerId + '-land-mask',
        type: 'fill',
        source: sourceId,
        filter: ['==', ['get', 'isLand'], true],
        paint: {
          'fill-color': mapStyle === 'satellite' ? 'transparent' : '#f8f9fa',
          'fill-opacity': mapStyle === 'satellite' ? 0 : 1
        }
      }, beforeId);

      map.current.addLayer({
        id: layerId + '-outline',
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'isSea'], true],
        layout: {
          'visibility': isSeaTypeMode ? 'visible' : 'none'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.8,
          'line-dasharray': [2, 2]
        }
      }, beforeId);

      // Nautical labels layer remains for context if needed, but suppressed based on user preference for "No IDs"
      /* 
      map.current.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: sourceId,
        filter: ['==', ['get', 'isSea'], true],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-allow-overlap': false,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
          'visibility': isSeaTypeMode ? 'visible' : 'none'
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
          'text-opacity': 0.9
        }
      });
      */
    }
  };

  useEffect(() => {
    if (isMapLoaded) {
      updateNauticalLayer();
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
              <div className="w-16 h-16 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Globe className="w-6 h-6 text-blue-600 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">AGID Maps</h3>
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
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-slate-100 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                {t('loading_style')}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          <div className="w-8 h-8 border-2 border-blue-500 rounded-full opacity-50 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-blue-600 rounded-full" />
        </div>
      </div>

      {/* Legal Links Footer Overlay */}
      <div className="absolute bottom-2 left-3 z-10 flex gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400/80 pointer-events-none">
        <button 
          onClick={() => { setActiveLegalDoc('privacy'); }}
          className="pointer-events-auto hover:text-slate-600 transition-colors"
        >
          Privacy Policy
        </button>
        <span className="opacity-30">•</span>
        <button 
          onClick={() => { setActiveLegalDoc('terms'); }}
          className="pointer-events-auto hover:text-slate-600 transition-colors"
        >
          Terms of Service
        </button>
      </div>

      {/* Unified Search Sidebar */}
      <div className={cn(
        "absolute z-40 transition-all duration-300 pointer-events-none flex flex-col gap-3",
        // Mobile focused state: takes over the screen
        isSearchFocused ? "inset-0 w-full h-full md:inset-auto md:top-6 md:left-3 md:w-80 md:h-[calc(100vh-48px)] p-0 md:p-0" : "top-2 left-3 right-3 md:top-6 md:left-3 md:w-80 md:h-auto p-0",
        "max-w-md"
      )}>
        <AnimatePresence mode="wait">
          {!isRoutePlanning || isGuidanceActive ? (
            <motion.div 
              key="search-box"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "bg-white shadow-xl border-slate-200 pointer-events-auto flex flex-col transition-all duration-300 ease-in-out max-h-full overflow-hidden",
                isSearchFocused ? "h-full rounded-none md:rounded-2xl" : "h-[48px] md:h-[56px] rounded-full md:rounded-2xl shadow-md border"
              )}
            >
              {/* Search Bar Header */}
              <div className="flex items-center p-1 md:p-1.5 gap-0.5 md:gap-1.5 shrink-0">
                <button 
                  onClick={() => {
                    if (isSearchFocused) {
                      setIsSearchFocused(false);
                      setSearchResults([]);
                    } else {
                      setShowMenu(true);
                    }
                  }}
                  className="p-2 md:p-2.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                >
                  {isSearchFocused ? (
                    <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  ) : (
                    <Menu className="w-5 h-5 md:w-6 md:h-6" />
                  )}
                </button>
                
                <form onSubmit={handleSearch} className="flex-1 flex items-center pr-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    placeholder={t('search_here')}
                    className="flex-1 bg-transparent px-2 md:px-3 py-2 md:py-2.5 focus:outline-none text-slate-800 placeholder-slate-400 font-medium text-sm md:text-base min-w-0"
                  />
                  
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        if (!searchResults.length) setIsSearchFocused(false);
                      }}
                      className="p-1.5 md:p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="hidden md:block w-[1px] h-6 bg-slate-200 mx-1" />
                  
                  {!isSearchFocused && !searchQuery ? null : (
                    <button 
                      type="submit"
                      disabled={isSearching}
                      className="p-2 md:p-2.5 text-blue-500 hover:bg-blue-50 rounded-full disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isSearching ? (
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </form>
              </div>

                    {/* Collapsible Search Content */}
                    <AnimatePresence>
                      {(isSearchFocused || searchResults.length > 0) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="flex flex-col flex-1 overflow-hidden"
                        >
                          <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-slate-50">
                      {/* Search Results (Highest Priority) */}
                      {searchResults.length > 0 && (
                        <div className="flex flex-col">
                          <div className="px-5 py-3 bg-slate-50/40 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Results</span>
                            <span className="text-[10px] font-bold text-blue-500">{searchResults.length} found</span>
                          </div>
                          {searchResults.map((result, idx) => (
                            <div key={idx} className="flex items-center hover:bg-blue-50/50 transition-all border-b border-slate-50 last:border-0 group">
                              <button
                                type="button"
                                onClick={() => selectSearchResult(result)}
                                className="flex-1 px-5 py-3 text-left flex flex-col gap-1"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                    <MapPin className="w-4 h-4" />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-slate-800 truncate">
                                      {result.display_name.split(',')[0]}
                                    </span>
                                    <span className="text-[10px] text-slate-400 truncate leading-tight">
                                      {result.display_name.split(',').slice(1).join(',').trim() || result.type}
                                    </span>
                                  </div>
                                  {result.source === 'local_db' && (
                                    <span className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-1.5 rounded-full uppercase tracking-tighter shrink-0">Native</span>
                                  )}
                                </div>
                              </button>
                              <div className="flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const lat = parseFloat(result.lat);
                                    const lng = parseFloat(result.lon);
                                    const name = result.display_name.split(',')[0];
                                    
                                    // Set destination and auto-route from current location if available
                                    setDestination({ lat, lng, name });
                                    setDestinationQuery(name);
                                    setIsRoutePlanning(true);
                                    setIsNavigating(true);
                                    setSearchResults([]);
                                    setIsSearchFocused(false);
                                    
                                    if (userLocation) {
                                      setOrigin({ lat: userLocation.lat, lng: userLocation.lng, name: "My Location" });
                                      setOriginQuery("My Location");
                                    }
                                  }}
                                  className="p-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-200 flex items-center gap-2"
                                  title="Get Directions"
                                >
                                  <ArrowUpRight className="w-5 h-5" />
                                  <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">経路</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* History (Medium Priority) */}
                      {searchHistory.length > 0 && (
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between px-5 py-2 bg-white">
                            <div className="flex items-center gap-2">
                              <History className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent Activity</span>
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                clearHistory();
                              }}
                              className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors px-2 py-0.5 rounded-lg hover:bg-red-50"
                            >
                              Clear
                            </button>
                          </div>
                          {searchHistory.map((query, idx) => (
                            <div key={idx} className="flex items-center hover:bg-slate-50 transition-colors group/history px-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchQuery(query);
                                  performSearch(query);
                                }}
                                className="flex-1 px-3 py-1.5 text-left flex items-center gap-3"
                              >
                                <div className="p-1 bg-slate-100 rounded-lg text-slate-400 group-hover/history:bg-blue-100 group-hover/history:text-blue-600 transition-all">
                                  <Clock className="w-3 h-3" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 truncate">{query}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  removeFromHistory(query);
                                }}
                                className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/history:opacity-100 transition-all"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Discover (Low Priority) */}
                      {searchResults.length === 0 && searchHistory.length === 0 && (
                        <div className="flex flex-col">
                          <div className="px-5 py-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Explore Nearby</span>
                          </div>
                          <div className="grid grid-cols-1 gap-1 px-3 pb-4">
                            {[
                              { name: "Tokyo, Japan", icon: <Flag className="w-4 h-4" />, color: "bg-red-50 text-red-600" },
                              { name: "New York City", icon: <Navigation className="w-4 h-4" />, color: "bg-blue-50 text-blue-600" },
                              { name: "London, UK", icon: <Flag className="w-4 h-4" />, color: "bg-indigo-50 text-indigo-600" },
                              { name: "Paris, France", icon: <Flag className="w-4 h-4" />, color: "bg-blue-100 text-blue-800" },
                              { name: "Mount Everest", icon: <MountainSnow className="w-4 h-4" />, color: "bg-emerald-50 text-emerald-600" }
                            ].map((place, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSearchQuery(place.name);
                                  performSearch(place.name);
                                }}
                                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-all rounded-2xl group border border-transparent hover:border-slate-100"
                              >
                                <div className={cn("p-2.5 rounded-xl transition-all shadow-sm group-hover:scale-110", place.color)}>
                                  {place.icon}
                                </div>
                                <div className="flex flex-col items-start">
                                  <span className="text-sm font-bold text-slate-700">{place.name}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">Quick Discovery</span>
                                </div>
                                <ChevronRight className="w-4 h-4 ml-auto text-slate-200 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Utility shortcuts (Always visible when in sidebar but not focused) */}
              {!(isSearchFocused || searchResults.length > 0) && (
                <div className="flex items-center gap-0.5 ml-auto pr-1.5 shrink-0">
                  <button 
                    type="button"
                    onClick={() => {
                      if (destinationQuery) {
                        setIsRoutePlanning(true);
                      } else {
                        setIsRoutePlanning(true);
                        if (userLocation) {
                          setOrigin({ ...userLocation, name: "My Location" });
                          setOriginQuery("My Location");
                        }
                      }
                    }}
                    className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl transition-all active:scale-95"
                    title="Directions"
                  >
                    <ArrowUpRight className="w-5 h-5" />
                  </button>

                  <div className="w-[1px] h-6 bg-slate-200 mx-1" />

                  <button 
                    type="button"
                    onClick={() => setShowQrOptions(!showQrOptions)}
                    className={cn(
                      "p-2.5 transition-all rounded-xl active:scale-95",
                      showQrOptions ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:bg-slate-50 hover:text-blue-600"
                    )}
                    title="QR Scan Options"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>

                  <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                  
                  <button 
                    type="button"
                    onClick={toggleTracking}
                    className={cn(
                      "p-2.5 transition-all rounded-xl active:scale-95 relative group",
                      isTracking ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:bg-slate-50 hover:text-blue-600"
                    )}
                    title={isTracking ? "Stop Tracking" : "Use Current Location"}
                  >
                    <Navigation className={cn("w-5 h-5", (isLocating || isTracking) && "animate-pulse text-blue-600")} />
                  </button>
                </div>
              )}

              {/* QR Options Overlay */}
              <AnimatePresence>
                {showQrOptions && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-full mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-[100] min-w-[160px]"
                  >
                    {[
                      { icon: <Camera className="w-4 h-4" />, label: "Camera", action: () => { setShowQrOptions(false); startQrScanner(); } },
                      { icon: <Upload className="w-4 h-4" />, label: "Upload", action: () => { setShowQrOptions(false); qrFileRef.current?.click(); } }
                    ].map((opt) => (
                      <button 
                        key={opt.label}
                        type="button"
                        onClick={opt.action}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 rounded-2xl transition-colors text-left group"
                      >
                        <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                          {opt.icon}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 group-hover:text-blue-700">{opt.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <input 
                type="file" 
                ref={qrFileRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleQrFileUpload}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="route-panel"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 pointer-events-auto p-4 flex flex-col gap-4 w-full"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Directions</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openExternalMap(defaultNavApp)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95"
                  >
                    <ExternalLink className="w-3 h-3" />
                    ナビ開始
                  </button>
                  <button 
                    onClick={() => {
                      setIsRoutePlanning(false);
                      setIsNavigating(false);
                      setRouteData(null);
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                {/* Visual Connector */}
                <div className="flex flex-col items-center py-2 gap-1 translate-y-3">
                  <div className="w-3 h-3 rounded-full border-2 border-slate-300 bg-white" />
                  <div className="w-0.5 flex-1 border-l-2 border-dotted border-slate-300" />
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                </div>

                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between mb-2 gap-4 overflow-x-auto pb-1 scrollbar-hide">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
                      <button 
                        onClick={() => setRoutingMode('driving')}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1 rounded-md transition-all",
                          routingMode === 'driving' ? "bg-white text-blue-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-700 font-bold"
                        )}
                      >
                        <Truck className="w-3 h-3" />
                        <span className="text-[10px] uppercase tracking-widest">車</span>
                      </button>
                      <button 
                        onClick={() => setRoutingMode('walking')}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1 rounded-md transition-all",
                          routingMode === 'walking' ? "bg-white text-blue-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-700 font-bold"
                        )}
                      >
                        <User className="w-3 h-3" />
                        <span className="text-[10px] uppercase tracking-widest">徒歩</span>
                      </button>
                    </div>

                    <button 
                      onClick={() => setUseBidirectionalDijkstra(!useBidirectionalDijkstra)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all border shrink-0 ml-auto",
                        useBidirectionalDijkstra 
                          ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm" 
                          : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      <Zap className={cn("w-3.5 h-3.5", useBidirectionalDijkstra && "fill-current text-blue-500")} />
                      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                        {useBidirectionalDijkstra ? "BD ON" : "ADV"}
                      </span>
                    </button>
                    
                    {isRoutingLoading && (
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative"
                  >
                    <input
                      type="text"
                      value={originQuery}
                      onChange={(e) => setOriginQuery(e.target.value)}
                      placeholder={t('starting_point')}
                      className="w-full bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-10"
                    />
                    {originQuery && (
                      <button 
                        onClick={() => { setOriginQuery(""); setOrigin(null); }}
                        className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                         if (userLocation) {
                           setOrigin({ ...userLocation, name: "My Location" });
                           setOriginQuery("My Location");
                         }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600"
                    >
                      <LocateFixed className="w-4 h-4" />
                    </button>
                    
                    {/* Origin Results */}
                    <AnimatePresence>
                      {originResults.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[60]"
                        >
                          {originResults.map((f, i) => (
                            <button key={i} onClick={() => selectOrigin(f)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0">
                              <span className="font-bold block truncate">{f.properties.name}</span>
                              <span className="text-slate-400 truncate block">{f.properties.city}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative"
                  >
                    <input
                      type="text"
                      value={destinationQuery}
                      onChange={(e) => setDestinationQuery(e.target.value)}
                      placeholder={t('destination')}
                      className="w-full bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-10"
                    />
                    {destinationQuery && (
                      <button 
                        onClick={() => { setDestinationQuery(""); setDestination(null); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    
                    {/* Destination Results */}
                    <AnimatePresence>
                      {destinationResults.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[60]"
                        >
                          {destinationResults.map((f, i) => (
                            <button key={i} onClick={() => selectDestination(f)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0">
                              <span className="font-bold block truncate">{f.properties.name}</span>
                              <span className="text-slate-400 truncate block">{f.properties.city}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>

                <div className="flex flex-col justify-center gap-2">
                </div>
              </div>

              <div className="flex gap-2 mt-1">
                <button 
                  onClick={() => {
                    const start = origin || userLocation;
                    if (start && destination) {
                      setIsNavigating(true);
                      if (map.current) {
                        const bounds = new maplibregl.LngLatBounds()
                          .extend([start.lng, start.lat])
                          .extend([destination.lng, destination.lat]);
                        map.current.fitBounds(bounds, { padding: 100 });
                      }
                    }
                  }}
                  disabled={!(origin || userLocation) || !destination}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                  {routeData ? 'Update Route' : 'Show Route'}
                </button>
                {routeData && (
                  <button 
                    onClick={() => setIsGuidanceActive(true)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 active:scale-95"
                  >
                    Start Guidance
                  </button>
                )}
              </div>

              {/* External Guidance Section */}
              {(origin || userLocation) && destination && (
                <div className="mt-2 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 mb-3">
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guide with External Map</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                    <button 
                      onClick={() => openExternalMap('google')}
                      className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:border-blue-200 group active:scale-[0.98]"
                    >
                      <img src="https://www.google.com/s2/favicons?domain=google.com" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                      <span className="text-[10px] font-bold text-slate-600">Google Maps</span>
                    </button>
                    <button 
                      onClick={() => openExternalMap('apple')}
                      className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:border-slate-400 group active:scale-[0.98]"
                    >
                      <img src="https://www.google.com/s2/favicons?domain=apple.com" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                      <span className="text-[10px] font-bold text-slate-600">Apple Maps</span>
                    </button>
                    <button 
                      onClick={() => openExternalMap('amap')}
                      className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:border-blue-200 active:scale-[0.98]"
                    >
                      <MapIcon className="w-4 h-4 text-blue-500" />
                      <span className="text-[10px] font-bold text-slate-600">Amap (高徳)</span>
                    </button>
                    <button 
                      onClick={() => openExternalMap('baidu')}
                      className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:border-blue-200 active:scale-[0.98]"
                    >
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span className="text-[10px] font-bold text-slate-600">Baidu (百度)</span>
                    </button>
                    <button 
                      onClick={() => openExternalMap('osmand')}
                      className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:border-orange-200 active:scale-[0.98]"
                    >
                      <Navigation className="w-4 h-4 text-orange-500" />
                      <span className="text-[10px] font-bold text-slate-600">OsmAnd</span>
                    </button>
                    <button 
                      onClick={() => openExternalMap('organic_maps')}
                      className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:border-emerald-200 active:scale-[0.98]"
                    >
                      <MapIcon className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-600">Organic Maps</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings Screen (Full-screen transition) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed inset-0 bg-white z-[200] flex flex-col pointer-events-auto"
            style={{ 
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)'
            }}
          >
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 md:py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      if (settingsTab === 'main') {
                        setShowSettings(false);
                      } else if (settingsTab === 'app-language' || settingsTab === 'address-language') {
                        setSettingsTab('app');
                      } else {
                        setSettingsTab('main');
                      }
                    }}
                    className="w-12 h-12 flex items-center justify-center hover:bg-slate-200 rounded-2xl transition-colors text-slate-600 active:scale-90"
                    title="Back"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 line-clamp-1">
                      {settingsTab === 'main' && t('settings')}
                      {settingsTab === 'home' && t('home')}
                      {settingsTab === 'app' && t('app_display')}
                      {settingsTab === 'location' && t('location_privacy')}
                      {settingsTab === 'offline' && t('offline_maps')}
                      {settingsTab === 'about' && t('about_terms')}
                      {settingsTab === 'help' && 'Help & Guides'}
                      {settingsTab === 'export' && t('export_center')}
                      {settingsTab === 'app-language' && t('app_language')}
                      {settingsTab === 'address-language' && t('address_language')}
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {settingsTab === 'main' && t('configure_experience')}
                      {settingsTab === 'home' && t('set_primary_location')}
                      {settingsTab === 'app' && t('customize_interface')}
                      {settingsTab === 'location' && t('manage_data_privacy')}
                      {settingsTab === 'offline' && t('download_map_data')}
                      {settingsTab === 'about' && t('info_legal')}
                      {settingsTab === 'help' && 'How to use AGID'}
                      {settingsTab === 'export' && t('pro_data_export')}
                      {settingsTab === 'app-language' && t('app_language')}
                      {settingsTab === 'address-language' && t('select_address_lang')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar relative pb-12">
                <div className="max-w-3xl mx-auto pb-safe">
                  <AnimatePresence mode="wait">
                    {settingsTab === 'main' && (
                      <motion.div 
                        key="main"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        className="p-6 space-y-6"
                      >
                        {/* Settings Hero Section */}
                        <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-8 md:p-12 mb-8 group">
                          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
                          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
                          
                          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                            <div className="w-24 h-24 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shrink-0">
                              <Settings className="w-10 h-10 animate-[spin_8s_linear_infinite]" />
                            </div>
                            <div className="text-center md:text-left">
                              <h4 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2 underline decoration-blue-500/50 decoration-4 underline-offset-4">
                                Preferences
                              </h4>
                              <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] max-w-md mx-auto md:mx-0">
                                Configure your AGID Global experience for maximum precision and usability.
                              </p>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => setSettingsTab('home')}
                          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-3xl transition-colors group active:bg-slate-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                              <Home className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm md:text-base text-slate-900">Home</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Set home AGID</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </button>

                        <button 
                          onClick={() => setSettingsTab('app')}
                          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-3xl transition-colors group active:bg-slate-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                              <Smartphone className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm md:text-base text-slate-900">App & Display</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Map, Units, Theme</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </button>

                        <button 
                          onClick={() => setSettingsTab('location')}
                          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-3xl transition-colors group active:bg-slate-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                              <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm md:text-base text-slate-900">Location & Privacy</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Permissions & Data</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </button>

                        <button 
                          onClick={() => setSettingsTab('offline')}
                          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-3xl transition-colors group active:bg-slate-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                              <Download className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm md:text-base text-slate-900">Offline Maps</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage downloads</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </button>

                        <button 
                          onClick={() => setSettingsTab('export')}
                          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-3xl transition-colors group active:bg-slate-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                              <FileDown className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm md:text-base text-slate-900">{t('export_center')}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GeoJSON, CSV, KML</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </button>

                        <button 
                          onClick={() => setSettingsTab('about')}
                          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-3xl transition-colors group active:bg-slate-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm md:text-base text-slate-900">About & Terms</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Version & Legal</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </button>

                        <button 
                          onClick={() => setSettingsTab('help')}
                          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 rounded-3xl transition-colors group active:bg-slate-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                              <Info className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm md:text-base text-slate-900">Help Center</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Guide & FAQ</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </button>
                      </motion.div>
                    )}

                    {settingsTab === 'export' && (
                      <motion.div 
                        key="export"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="p-8 space-y-10"
                      >
                        <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                          <h4 className="text-sm font-black text-indigo-900 mb-2 uppercase tracking-widest">{t('pro_data_export')}</h4>
                          <p className="text-xs text-indigo-800/70 leading-relaxed mb-6">
                            Download your spatial data in industry-standard formats for GIS, analytics, or navigation.
                          </p>

                          <div className="space-y-4">
                            <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <Bookmark className="w-4 h-4 text-indigo-600" />
                                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                    {t('saved_locations_count').replace('{{count}}', String(savedAgids.length))}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                <button 
                                  disabled={savedAgids.length === 0}
                                  onClick={() => {
                                    const data: ExportData[] = savedAgids.map(a => ({
                                      id: a.id,
                                      lat: a.lat,
                                      lon: a.lng,
                                      name: a.name || a.address,
                                      type: 'Saved Point',
                                      timestamp: new Date().toISOString()
                                    }));
                                    ExportService.exportToGeoJSON(data, `agid_saved_${new Date().getTime()}.geojson`);
                                  }}
                                  className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 flex items-center justify-center gap-2"
                                >
                                  <FileDown className="w-3.5 h-3.5" /> {t('export_geojson')}
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                  <button 
                                    disabled={savedAgids.length === 0}
                                    onClick={() => {
                                      const data: ExportData[] = savedAgids.map(a => ({
                                        id: a.id,
                                        lat: a.lat,
                                        lon: a.lng,
                                        name: a.name || a.address,
                                        type: 'Saved Point',
                                        timestamp: new Date().toISOString()
                                      }));
                                      ExportService.exportToCSV(data, `agid_saved_${new Date().getTime()}.csv`);
                                    }}
                                    className="py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                                  >
                                    {t('export_csv')}
                                  </button>
                                  <button 
                                    disabled={savedAgids.length === 0}
                                    onClick={() => {
                                      const data: ExportData[] = savedAgids.map(a => ({
                                        id: a.id,
                                        lat: a.lat,
                                        lon: a.lng,
                                        name: a.name || a.address,
                                        type: 'Saved Point',
                                        timestamp: new Date().toISOString()
                                      }));
                                      ExportService.exportToKML(data, `agid_saved_${new Date().getTime()}.kml`);
                                    }}
                                    className="py-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                                  >
                                    {t('export_kml')}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <History className="w-4 h-4 text-indigo-600" />
                                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Search History ({searchHistory.length})</span>
                                </div>
                              </div>
                              <button 
                                disabled={searchHistory.length === 0}
                                onClick={() => {
                                  const csvContent = "Query\n" + searchHistory.join("\n");
                                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                  saveAs(blob, `agid_history_${new Date().getTime()}.csv`);
                                }}
                                className="w-full py-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 flex items-center justify-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5" /> Download History CSV
                              </button>
                            </div>

                            <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-indigo-600" />
                                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{t('current_view')}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  if (!map.current) return;
                                  const center = map.current.getCenter();
                                  const zoom = map.current.getZoom();
                                  const data = {
                                    lat: center.lat,
                                    lon: center.lng,
                                    zoom: zoom,
                                    timestamp: new Date().toISOString()
                                  };
                                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                  saveAs(blob, `agid_view_${new Date().getTime()}.json`);
                                }}
                                className="w-full py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                              >
                                <Share2 className="w-3.5 h-3.5" /> Save Current Coordinates
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {settingsTab === 'home' && (
                      <motion.div 
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="p-8 space-y-8"
                      >
                        <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                          <p className="text-sm font-bold text-blue-900 mb-2">Home AGID</p>
                          <p className="text-xs text-blue-700/70 mb-4 leading-relaxed">
                            Set your home location to quickly jump back or use it as a reference point.
                          </p>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={homeAgid}
                              onChange={(e) => setHomeAgid(e.target.value.toUpperCase())}
                              placeholder="Enter AGID (e.g. JP12345678)"
                              className="flex-1 bg-white border border-blue-200 rounded-2xl px-4 py-3 text-sm font-black font-mono focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                            />
                            <button 
                              onClick={() => {
                                if (clickedAgid) setHomeAgid(clickedAgid.id);
                              }}
                              className="px-4 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                            >
                              Use Current
                            </button>
                          </div>
                        </div>

                        {homeAgid && (
                          <button 
                            onClick={() => jumpToAgid(homeAgid)}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
                          >
                            Jump to Home
                          </button>
                        )}
                      </motion.div>
                    )}

                    {settingsTab === 'app' && (
                      <motion.div 
                        key="app"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="p-8 space-y-10"
                      >
                        {/* Language Selection */}
                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-blue-600">
                            <Globe className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">言語設定</h3>
                          </div>
                          <div className="grid gap-3">
                            <button 
                              onClick={() => setSettingsTab('app-language')}
                              className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                            >
                              <div className="text-left">
                                <p className="text-sm font-bold text-slate-700">アプリの言語</p>
                                <p className="text-[10px] text-slate-400 font-medium">UIの表示言語を選択します</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                  {LANGUAGES.find(l => l.code === appLanguage)?.name || appLanguage}
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                              </div>
                            </button>

                            <button 
                              onClick={() => setSettingsTab('address-language')}
                              className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                            >
                              <div className="text-left">
                                <p className="text-sm font-bold text-slate-700">住所の言語</p>
                                <p className="text-[10px] text-slate-400 font-medium">住所表示の優先言語を選択します</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                  {LANGUAGES.find(l => l.code === addressLanguage)?.name || addressLanguage}
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                              </div>
                            </button>
                          </div>
                        </section>

                        {/* Mode */}
                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-purple-600">
                            <Smartphone className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">モード</h3>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-700">テーマ</p>
                              <p className="text-[10px] text-slate-400 font-medium">ライト、ダーク、またはシステム設定</p>
                            </div>
                            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200">
                              <button 
                                onClick={() => setThemeMode('light')}
                                className={cn(
                                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                  themeMode === 'light' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                ライト
                              </button>
                              <button 
                                onClick={() => setThemeMode('dark')}
                                className={cn(
                                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                  themeMode === 'dark' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                ダーク
                              </button>
                              <button 
                                onClick={() => setThemeMode('system')}
                                className={cn(
                                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                  themeMode === 'system' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                システム
                              </button>
                            </div>
                          </div>
                        </section>

                        {/* Distance Units & Navigation */}
                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-amber-600">
                            <Ruler className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">距離の単位とナビゲーション</h3>
                          </div>
                          <div className="grid gap-4">
                            <div className="p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-bold text-slate-700">単位</p>
                                <p className="text-[10px] text-slate-400 font-medium">表示単位を選択します</p>
                              </div>
                              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200">
                                {['automatic', 'kilometers', 'miles'].map((unit) => (
                                  <button 
                                    key={unit}
                                    onClick={() => setDistanceUnit(unit as any)}
                                    className={cn(
                                      "flex-1 md:flex-none md:px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                      distanceUnit === unit ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                    )}
                                  >
                                    {unit === 'automatic' ? '自動' : unit === 'kilometers' ? 'キロ' : 'マイル'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Navigation className="w-4 h-4 text-blue-600" />
                                  <p className="text-sm font-bold text-slate-700">デフォルトのナビアプリ</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                  { id: 'google', name: 'Google' },
                                  { id: 'apple', name: 'Apple' },
                                  { id: 'amap', name: '高徳 (AMap)' },
                                  { id: 'baidu', name: '百度 (Baidu)' },
                                  { id: 'osmand', name: 'OsmAnd' },
                                  { id: 'organic_maps', name: 'Organic' },
                                  { id: 'waze', name: 'Waze' }
                                ].map(app => (
                                  <button
                                    key={app.id}
                                    onClick={() => setDefaultNavApp(app.id as any)}
                                    className={cn(
                                      "px-4 py-4 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2 active:scale-95",
                                      defaultNavApp === app.id 
                                        ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" 
                                        : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                                    )}
                                  >
                                    <span className="truncate">{app.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </section>

                        {/* Map Appearance (Keep as secondary) */}
                        <section className="space-y-4 pt-6 border-t border-slate-100">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Layers className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">詳細設定</h3>
                          </div>
                          <div className="grid gap-4">
                            <div className="flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100">
                              <div>
                                <p className="text-sm font-bold text-slate-700">地図のスタイル</p>
                                <p className="text-[10px] text-slate-400 font-medium md:hidden">ベースマップの背景を変更します</p>
                              </div>
                              <select 
                                value={mapStyle}
                                onChange={(e) => changeStyle(e.target.value)}
                                className="w-full md:w-auto bg-white border border-slate-200 rounded-xl px-4 py-3 md:py-1.5 text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none text-center"
                              >
                                <option value="https://tiles.openfreemap.org/styles/bright">Bright</option>
                                <option value="https://tiles.openfreemap.org/styles/liberty">Liberty</option>
                                <option value="https://tiles.openfreemap.org/styles/positron">Positron</option>
                                <option value="https://tiles.openfreemap.org/styles/dark">Dark</option>
                                <option value="satellite">Satellite</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                              <button 
                                onClick={() => setIs3DEnabled(!is3DEnabled)}
                                className={cn(
                                  "flex items-center justify-between p-5 md:p-6 rounded-2xl border transition-all active:scale-[0.98]",
                                  is3DEnabled ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-slate-50 border-slate-100"
                                )}
                              >
                                <div className="flex flex-col items-start gap-1">
                                  <span className={cn("text-sm font-black uppercase tracking-widest", is3DEnabled ? "text-blue-700" : "text-slate-600")}>3D表示</span>
                                  <span className="text-[10px] font-bold text-slate-400">地形の起伏を有効化</span>
                                </div>
                                <div className={cn("w-3 h-3 rounded-full", is3DEnabled ? "bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]" : "bg-slate-300")} />
                              </button>
                            </div>

                            <div className="p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <RotateCcw className="w-4 h-4 text-slate-500" />
                                  <p className="text-sm font-bold text-slate-700">地図の斜度</p>
                                </div>
                                <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                                  {[0, 45, 60].map((p) => (
                                    <button
                                      key={p}
                                      onClick={() => setMapPitch(p)}
                                      className={cn(
                                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        mapPitch === p ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                                      )}
                                    >
                                      {p}°
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-slate-500" />
                                    <p className="text-sm font-bold text-slate-700">グリッドの濃さ</p>
                                  </div>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Level {gridOpacityLevel}</span>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  {[1, 2, 3, 4, 5].map((lv) => (
                                    <button
                                      key={lv}
                                      onClick={() => setGridOpacityLevel(lv)}
                                      className={cn(
                                        "flex-1 py-3 rounded-xl transition-all border-2 flex items-center justify-center",
                                        gridOpacityLevel === lv 
                                          ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-100" 
                                          : "bg-white border-slate-100 hover:border-slate-200"
                                      )}
                                    >
                                      <div 
                                        className={cn(
                                          "w-full h-1 rounded-full mx-2",
                                          gridOpacityLevel === lv ? "bg-white/80" : "bg-slate-200"
                                        )}
                                        style={{ opacity: lv / 5 }}
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </section>
                      </motion.div>
                    )}

                    {settingsTab === 'location' && (
                      <motion.div 
                        key="location"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="p-8 space-y-10"
                      >
                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-blue-600">
                            <ShieldCheck className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Permissions</h3>
                          </div>
                          <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                                  <MapPin className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-bold text-slate-700">Geolocation</span>
                              </div>
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">Enabled</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                              AGID uses your location to encode the grid cell you are currently in and to provide navigation guidance. Your location data is processed locally and never stored on our servers.
                            </p>
                          </div>
                        </section>

                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-red-600">
                            <Database className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Data Management</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <button 
                              onClick={() => {
                                showConfirm('Clear Data', 'Are you sure you want to clear all saved AGIDs?', () => {
                                  setSavedAgids([]);
                                  localStorage.removeItem('saved_agids');
                                });
                              }}
                              className="flex flex-col items-center justify-center gap-2 p-6 bg-red-50 border border-red-100 rounded-3xl hover:bg-red-100 transition-colors group"
                            >
                              <Trash2 className="w-6 h-6 text-red-500 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Clear Saved</span>
                            </button>
                            <button 
                              onClick={() => {
                                showConfirm('Reset Settings', 'Reset all preferences to default?', () => {
                                  localStorage.clear();
                                  window.location.reload();
                                });
                              }}
                              className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-slate-100 transition-colors group"
                            >
                              <History className="w-6 h-6 text-slate-500 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Reset All</span>
                            </button>
                          </div>
                        </section>

                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-slate-900">
                            <BookOpen className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Legal & Privacy</h3>
                          </div>
                          <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                            <button 
                              onClick={() => setActiveLegalDoc('privacy')}
                              className="w-full flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                <ShieldCheck className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                <span className="text-sm font-bold text-slate-700">Privacy Policy</span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <div className="h-px bg-slate-200" />
                            <button 
                              onClick={() => setActiveLegalDoc('terms')}
                              className="w-full flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                <Scale className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
                                <span className="text-sm font-bold text-slate-700">Terms of Service</span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </section>
                      </motion.div>
                    )}

                    {settingsTab === 'offline' && (
                      <motion.div 
                        key="offline"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="p-8 space-y-8"
                      >
                        <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100 text-center space-y-6">
                          <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto text-amber-600 shadow-xl shadow-amber-900/5">
                            <Download className="w-10 h-10" />
                          </div>
                          <div>
                            <h4 className="text-xl font-black text-amber-900 mb-2">Offline Maps</h4>
                            <p className="text-sm font-bold text-amber-700/60 leading-relaxed">
                              Download map areas to use AGID without an internet connection.
                            </p>
                          </div>
                          <div className="p-4 bg-white/50 rounded-2xl text-[10px] font-black text-amber-600 uppercase tracking-widest">
                            Feature coming soon
                          </div>
                        </div>

                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Current Cache</p>
                          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100">
                            <div className="flex items-center gap-3">
                              <Database className="w-5 h-5 text-slate-400" />
                              <span className="text-sm font-bold text-slate-700">Tile Cache</span>
                            </div>
                            <span className="text-xs font-black text-slate-400">12.4 MB</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {settingsTab === 'about' && (
                      <motion.div 
                        key="about"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="p-8 space-y-10"
                      >
                        <div className="text-center space-y-4">
                          <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center mx-auto text-white shadow-2xl">
                            <Grid3X3 className="w-12 h-12" />
                          </div>
                          <div>
                            <h4 className="text-2xl font-black text-slate-900 tracking-tighter">AGID Explorer</h4>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Version 2.4.0-PRO</p>
                          </div>
                        </div>

                        {/* Global Coverage (Moved here) */}
                        <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-xl space-y-6">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Global Coverage</h5>
                            <BarChart3 className="w-4 h-4 text-white/40" />
                          </div>
                          <div className="space-y-5">
                            {MAJOR_CATEGORIES.slice(0, 3).map(cat => {
                              const stats = registryStats.regionStats[cat.id];
                              if (!stats || stats.total === 0) return null;
                              const percentage = Math.round((stats.total / registryStats.globalStats.total) * 100);
                              return (
                                <div key={cat.id} className="space-y-2">
                                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span>{cat.name}</span>
                                    <span className="text-white/60">{percentage}%</span>
                                  </div>
                                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${percentage}%` }}
                                      className="h-full bg-blue-500 rounded-full"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            <button 
                              onClick={() => setShowResources(true)}
                              className="w-full mt-4 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
                            >
                              Detailed Global Resources
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <button 
                              onClick={() => setShowLicenses(true)}
                              className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-colors"
                            >
                              Licenses
                            </button>
                            <button 
                              onClick={() => setActiveLegalDoc('privacy')}
                              className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-colors"
                            >
                              Privacy
                            </button>
                            <button 
                              onClick={() => setActiveLegalDoc('terms')}
                              className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-colors"
                            >
                              Terms
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {settingsTab === 'help' && (
                      <motion.div 
                        key="help"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="p-8 space-y-10"
                      >
                         <section>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <div className="w-1 h-3 bg-blue-600 rounded-full" />
                              What is AGID? (AGIDとは)
                            </h3>
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-sm leading-relaxed text-slate-600 font-medium">
                              <p>
                                <strong className="text-slate-900 font-bold">Absolute Global Identity (AGID)</strong> は、地球上のすべての場所（4m×4mのグリッド）に付与された不変で唯一のIDです。住所のない海の上や山奥でも、確定的な位置を特定することができます。
                              </p>
                            </div>
                          </section>

                          <section>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                               <div className="w-1 h-3 bg-blue-600 rounded-full" />
                               Device View Standards (表示基準)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {[
                                { icon: Smartphone, label: "Smartphone", detail: "直径 約60m" },
                                { icon: Box, label: "Tablet", detail: "直径 約100m" },
                                { icon: MapIcon, label: "PC", detail: "半径 80m (直径160m)" }
                              ].map((device, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center text-center">
                                  <device.icon className="w-5 h-5 text-slate-400 mb-2" />
                                  <span className="text-[10px] font-black text-slate-900 uppercase mb-1">{device.label}</span>
                                  <span className="text-[10px] font-bold text-blue-600">{device.detail}</span>
                                </div>
                              ))}
                            </div>
                          </section>

                          <section>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <div className="w-1 h-3 bg-blue-600 rounded-full" />
                              Basic Navigation (基本操作)
                            </h3>
                            <ul className="grid grid-cols-1 gap-3">
                              {[
                                { icon: MapPin, label: "Click to Select", desc: "グリッドをクリックしてその場所のIDと住所を表示します。" },
                                { icon: Search, label: "Smart Search", desc: "AGID、住所、地名などで直接検索できます。" },
                                { icon: LocateFixed, label: "My Location", desc: "GPSを使用して現在地のAGIDを特定します。" },
                                { icon: Layers, label: "Layers & Tilt", desc: "地形（3D）や航空写真、傾きを調整して視認性を高めます。" }
                              ].map((item, idx) => (
                                <li key={idx} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group">
                                  <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                                    <item.icon className="w-4 h-4 text-blue-500" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900 mb-0.5">{item.label}</h4>
                                    <p className="text-[10px] font-medium text-slate-500 leading-normal">{item.desc}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </section>
                      </motion.div>
                    )}

                    {(settingsTab === 'app-language' || settingsTab === 'address-language') && (
                      <motion.div 
                        key="language-selection"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="p-6 space-y-4"
                      >
                        <div className="grid gap-2">
                          {LANGUAGES.map((lang) => (
                            <button
                              key={lang.code}
                              onClick={() => {
                                if (settingsTab === 'app-language') {
                                  setAppLanguage(lang.code);
                                  localStorage.setItem('agid_app_language', lang.code);
                                } else {
                                  setAddressLanguage(lang.code);
                                  localStorage.setItem('agid_address_language', lang.code);
                                }
                                setSettingsTab('app');
                              }}
                              className={cn(
                                "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                                (settingsTab === 'app-language' ? appLanguage === lang.code : addressLanguage === lang.code)
                                  ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500/10" 
                                  : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                              )}
                            >
                              <div>
                                <p className={cn("text-sm font-bold", (settingsTab === 'app-language' ? appLanguage === lang.code : addressLanguage === lang.code) ? "text-blue-700" : "text-slate-700")}>
                                  {lang.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">{lang.country}</p>
                              </div>
                              {(settingsTab === 'app-language' ? appLanguage === lang.code : addressLanguage === lang.code) && (
                                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div 
                className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">Version 2.4.0 (Stable)</p>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full md:w-auto px-12 py-4 md:py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side Menu Drawer */}
      <AnimatePresence mode="wait">
        {showMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] pointer-events-auto"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350, mass: 1 }}
              className="fixed top-0 left-0 bottom-0 w-72 md:w-48 bg-white/95 backdrop-blur-xl shadow-2xl z-[101] pointer-events-auto flex flex-col border-r border-white/20"
              style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: 'env(safe-area-inset-left)',
              }}
            >
              <div className="px-3 py-6 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-slate-900 flex items-center justify-center">
                    <Globe className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-xl font-black tracking-tighter text-slate-900 uppercase block leading-none">AGID</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMenu(false)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-900 active:scale-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-6 space-y-8 custom-scrollbar">
                {/* Personal Section */}
                <section className="space-y-4">
                  <h3 className="px-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Personal Space</h3>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { icon: Bookmark, label: "Saved Locations", color: "blue", onClick: () => { setSavedTab('agid'); setShowSaved(true); } },
                      { icon: ShieldIcon, label: "Verified AOIDs", color: "emerald", onClick: () => { setSavedTab('aoid'); setShowSaved(true); } },
                      { icon: HomeIcon, label: "Register Address", color: "blue", onClick: () => { setAoidModeForced(false); setShowAddressRegistration(true); } },
                    ].map((item, idx) => (
                      <motion.button 
                        key={idx}
                        whileHover={{ x: 4 }}
                        onClick={() => { item.onClick(); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-1.5 py-3 hover:bg-slate-50 rounded-2xl transition-all group"
                      >
                        <div className={cn(
                          "transition-all",
                          item.color === 'blue' ? "text-blue-600 group-hover:text-blue-700" :
                          "text-emerald-600 group-hover:text-emerald-700"
                        )}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-700 text-sm group-hover:text-slate-900 transition-colors">{item.label}</span>
                        <ChevronRight className="w-4 h-4 ml-auto text-slate-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                      </motion.button>
                    ))}
                  </div>
                </section>

                {/* AOID Private List (Mini) */}
                {aoids.length > 0 && (
                  <section className="space-y-4">
                    <div className="px-1.5 flex items-center justify-between">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">My AOIDs</h3>
                      <button 
                        onClick={() => { setSavedTab('aoid'); setShowSaved(true); setShowMenu(false); }}
                        className="text-[10px] font-black text-emerald-600 hover:underline"
                      >
                        All
                      </button>
                    </div>
                    <div className="space-y-2">
                       {aoids.slice(0, 2).map((aoid: AOIDData) => (
                         <button 
                           key={aoid.id}
                           onClick={() => {
                             setLat(aoid.lat);
                             setLng(aoid.lng);
                             setZoom(18);
                             setShowMenu(false);
                           }}
                           className="w-full text-left p-1.5 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group"
                         >
                           <div className="flex items-center gap-2">
                             <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600 font-mono text-[9px] font-black">
                               {aoid.id.slice(0, 4)}
                             </div>
                             <div className="min-w-0">
                               <div className="text-xs font-bold text-slate-700 truncate">{aoid.name}</div>
                               <div className="text-[9px] text-slate-400 truncate">{aoid.address}</div>
                             </div>
                           </div>
                         </button>
                       ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="px-3 py-6 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-start gap-4 px-1.5">
                  <button onClick={() => { setShowSettings(true); setShowMenu(false); }} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><Settings className="w-5 h-5" /></button>
                  <button onClick={() => { 
                    navigator.clipboard.writeText(window.location.href);
                    setCopied('link');
                    setTimeout(() => setCopied(null), 2000);
                  }} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                    {copied === 'link' ? <Check className="w-5 h-5 text-emerald-500" /> : <Share2 className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">© 2026 AGID Global</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className={cn(
        "absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-[450px] px-4 flex flex-col gap-4 pointer-events-none transition-all duration-500",
        isAgidPanelCollapsed && "bottom-2"
      )}>
        {/* Selected Location Panel - Improved UX */}
        <AnimatePresence mode="wait">
          {!showPostalCodeLab && clickedAgid && (
            <motion.div 
              layout
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className={cn(
                "bg-slate-900/90 backdrop-blur-xl shadow-2xl border pointer-events-auto text-white transition-all duration-500 overflow-hidden mx-auto",
                clickedAgid.id.startsWith('IN') ? "border-orange-500/30" : clickedAgid.id.startsWith('ZA') ? "border-green-500/30" : "border-slate-800",
                isAgidPanelCollapsed 
                   ? "w-14 h-14 rounded-full flex items-center justify-center p-0 cursor-pointer hover:bg-slate-800 hover:scale-110 active:scale-95 shadow-red-500/20 shadow-lg" 
                   : "w-full rounded-[2rem] p-4"
              )}
              onClick={isAgidPanelCollapsed ? () => setIsAgidPanelCollapsed(false) : undefined}
            >
              <div className={cn("flex flex-col gap-2 w-full h-full", isAgidPanelCollapsed && "items-center justify-center")}>
                {isAgidPanelCollapsed ? (
                   <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center"
                   >
                       <div className="relative">
                        <div className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.7)]" />
                        <div className={cn(
                          "absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full animate-pulse",
                          isAgidPinnedToGps ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                        )} />
                       </div>
                   </motion.div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="p-1.5 bg-red-500/10 rounded-lg">
                          <MapPin className="w-3.5 h-3.5 text-red-500" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-red-400/90 truncate max-w-[150px]">
                          {clickedAgid.isSea ? "Maritime" : (clickedAgid.id.startsWith('IN') ? "Bharat" : clickedAgid.id.startsWith('ZA') ? "SA" : "Selection")}
                        </span>
                        {isAgidPinnedToGps && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full animate-pulse">
                            <Target className="w-2 h-2 text-amber-500" />
                            <span className="text-[7px] font-black uppercase text-amber-500 tracking-tighter">GPS Locked</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsAgidPanelCollapsed(true); }}
                          className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-white"
                          title="Collapse"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => {
                             e.stopPropagation();
                             setIsManualSelection(false);
                             if (map.current) {
                               const center = map.current.getCenter();
                               const result = encodeAGID(center.lat, center.lng);
                               setClickedAgid(null);
                               setClickedAddress("");
                             }
                             setIsQrVisible(false);
                             setIsAgidPanelCollapsed(false);
                          }}
                          className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                       <div className="flex items-center justify-between gap-3 px-0.5">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <motion.div 
                            layoutId="agid-text"
                            className="font-black text-white tracking-widest font-mono truncate text-lg"
                          >
                            {clickedAgid.id}
                          </motion.div>
                          <button 
                            onClick={() => {
                               const addr = clickedAddressTab === 'translated' ? clickedAddressTranslated : clickedAddressMap[clickedAddressTab] || clickedAddress;
                               const fullText = `${clickedAgid.id}${addr ? ` (${addr})` : ''}`;
                               navigator.clipboard.writeText(fullText);
                               setCopied('agid');
                               setTimeout(() => setCopied(null), 2000);
                            }}
                            className="p-1 hover:bg-white/10 text-slate-400 rounded-lg transition-all active:scale-95"
                            title="Copy ID & Address"
                          >
                            {copied === 'agid' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-0.5 font-mono">
                          <button 
                            onClick={() => {
                               if (map.current && clickedAgid) {
                                 map.current.flyTo({
                                   center: [(clickedAgid.bounds.minLon + clickedAgid.bounds.maxLon) / 2, (clickedAgid.bounds.minLat + clickedAgid.bounds.maxLat) / 2],
                                   zoom: getDeviceZoom(),
                                   pitch: mapPitch,
                                   essential: true
                                 });
                               }
                            }}
                            className="p-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-md transition-all"
                            title="Zoom to location"
                          >
                            <Maximize2 className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            onClick={(e) => {
                               e.stopPropagation();
                               const next = !isAgidPinnedToGps;
                               setIsAgidPinnedToGps(next);
                               if (next && userLocation) {
                                 const result = encodeAGID(userLocation.lat, userLocation.lng);
                                 setClickedAgid(result);
                                 showAlert("AGID Locked", "Pinning current location...");
                                 reverseGeocode(userLocation.lat, userLocation.lng, result.prefix, result.isSea, true);
                               } else if (!next) {
                                 showAlert("AGID Unlocked", "Selection unlocked.");
                               }
                            }}
                            className={cn(
                               "p-1 rounded-md transition-all border",
                               isAgidPinnedToGps 
                                ? "bg-amber-600/30 text-amber-400 border-amber-500/40 animate-pulse" 
                                : "bg-white/5 hover:bg-white/10 text-slate-400 border-white/5"
                            )}
                            title={isAgidPinnedToGps ? "Unlock AGID" : "Lock to GPS"}
                          >
                            <Key className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            onClick={() => setIsQrVisible(!isQrVisible)}
                            className={cn(
                               "p-1 rounded-md transition-all border",
                               isQrVisible 
                                ? "bg-purple-600/30 text-purple-400 border-purple-500/40" 
                                : "bg-white/5 hover:bg-white/10 text-slate-400 border-white/5"
                            )}
                            title="Show QR Code"
                          >
                            <QrCode className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            onClick={() => {
                               const lat = (clickedAgid.bounds.minLat + clickedAgid.bounds.maxLat) / 2;
                               const lng = (clickedAgid.bounds.minLon + clickedAgid.bounds.maxLon) / 2;
                               const name = clickedAddress || clickedAgid.id;
                               setDestination({ lat, lng, name });
                               setDestinationQuery(name);
                               setIsRoutePlanning(true);
                               setIsNavigating(true);
                               if (userLocation) {
                                 setOrigin({ ...userLocation, name: "My Location" });
                                 setOriginQuery("My Location");
                               }
                            }}
                            className="p-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/30 active:scale-95"
                            title="Get Directions"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-tight">経路案内</span>
                          </button>
                        </div>
                       </div>

                       <motion.div 
                        key="expanded-content"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                       >
                         {/* Territory Info */}
                         {clickedAgid.isSea && clickedAgid.regionName && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg w-fit">
                              <Waves className="w-2.5 h-2.5 text-blue-400" />
                              <span className="text-[9px] font-black text-blue-200">{clickedAgid.regionName}</span>
                            </div>
                         )}

                         {/* Address Area */}
                         <div className="group relative bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/[0.08] transition-colors">
                          <div className="flex flex-col gap-2">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                                 {/* Native Language Tabs */}
                                 {clickedActiveLangs.filter(l => l !== 'en').map((langCode) => (
                                   <button
                                     key={langCode}
                                     onClick={() => {
                                       const isAlreadyActive = clickedAddressTab === langCode;
                                       setClickedAddressTab(langCode);
                                       if (isAlreadyActive || !clickedAddressMap[langCode]) {
                                         const l = (clickedAgid.bounds.minLat + clickedAgid.bounds.maxLat) / 2;
                                         const n = (clickedAgid.bounds.minLon + clickedAgid.bounds.maxLon) / 2;
                                         fetchAddressForLang(l, n, langCode, true, clickedAgid.id.slice(0, 2), isAlreadyActive);
                                       }
                                     }}
                                     className={cn(
                                       "px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5",
                                       clickedAddressTab === langCode 
                                        ? "bg-slate-800 text-white shadow-lg" 
                                        : "bg-white/5 text-slate-500 hover:bg-white/10"
                                     )}
                                   >
                                     <Flag className="w-2.5 h-2.5" />
                                     <span>{LANGUAGES.find(l => l.code === langCode)?.name || "Native"}</span>
                                   </button>
                                 ))}

                                 <button
                                   onClick={() => setClickedAddressTab('en')}
                                   className={cn(
                                     "px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5",
                                     clickedAddressTab === 'en' 
                                      ? "bg-slate-100 text-slate-900 shadow-lg" 
                                      : "bg-white/5 text-slate-500 hover:bg-white/10"
                                   )}
                                 >
                                   <Globe className="w-2.5 h-2.5" />
                                   <span>English</span>
                                 </button>
                               </div>
                             </div>

                             <div className="text-[11px] font-medium text-slate-200 leading-snug min-h-[2.5em]">
                                {clickedAddressMap[clickedAddressTab] || 
                                 (clickedAddressTab === 'en' ? (fastJapaneseTransliterate(clickedAddress) || "Translating...") : clickedAddress) || 
                                 "Resolving..."}
                             </div>

                             <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-white/5 overflow-x-auto no-scrollbar">
                                <button onClick={() => saveAgid(clickedAgid)} className="p-1.5 bg-white/5 rounded-lg text-slate-500"><Bookmark className="w-3 h-3" /></button>
                                <button onClick={() => setShowLocationAnalysis(!showLocationAnalysis)} className="p-1.5 bg-white/5 rounded-lg text-slate-500"><Zap className="w-3 h-3" /></button>
                                <button onClick={() => setIsQrVisible(!isQrVisible)} className="p-1.5 bg-white/5 rounded-lg text-slate-500"><QrCode className="w-3 h-3" /></button>
                             </div>
                          </div>
                         </div>

                         <AnimatePresence>
                          {isQrVisible && (
                             <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="bg-white rounded-[2rem] p-5 flex flex-col items-center gap-3 mt-3"
                             >
                                <div className="p-3 bg-slate-50 rounded-2xl shadow-inner">
                                 <QRCodeCanvas value={clickedAgid.id} size={120} level="H" includeMargin={false} id="agid-qr-canvas" />
                                </div>
                                <button onClick={saveQrCode} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border border-slate-200">
                                 <Download className="w-2.5 h-2.5" /> Save QR
                                </button>
                             </motion.div>
                          )}
                         </AnimatePresence>
                       </motion.div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
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
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-amber-200 flex items-center gap-6 pointer-events-auto"
          >
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                <Ruler className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Distance</p>
                <p className="text-lg font-black text-slate-900 tracking-tight">
                  {rulerPoints.length === 2 
                    ? formatDistance(calculateDistance(rulerPoints[0][1], rulerPoints[0][0], rulerPoints[1][1], rulerPoints[1][0]), distanceUnit)
                    : "Select second point"}
                </p>
              </div>
            </div>

            {rulerPoints.length === 2 && (
              <div className="flex items-center gap-3 border-l border-slate-100 pl-6">
                <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Bearing</p>
                  <p className="text-lg font-black text-slate-900 tracking-tight">
                    {calculateBearing(rulerPoints[0][1], rulerPoints[0][0], rulerPoints[1][1], rulerPoints[1][0]).toFixed(1)}°
                  </p>
                </div>
              </div>
            )}

            <button 
              onClick={() => setRulerPoints([])}
              className="ml-4 p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
              title="Clear Points"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layers Bottom Sheet */}
      <AnimatePresence>
        {showStyleMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStyleMenu(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] pointer-events-auto"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2rem] shadow-2xl z-[101] pointer-events-auto overflow-hidden"
            >
              <div className="max-w-4xl mx-auto p-4 md:p-6">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <Layers className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Map Layers</h3>
                  </div>
                  <button 
                    onClick={() => setShowStyleMenu(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
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
                            if (map.current) map.current.setPitch(val);
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
                            {isSystematicMode && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
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
                            {isRegionalMode && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
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
                            {isNauticalMode && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
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
                            {isSeaTypeMode && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-500 rounded-full" />}
                          </div>
                          <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", isSeaTypeMode ? "text-cyan-600" : "text-slate-500")}>
                            Sea Type
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
                            {is3DEnabled && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
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
                            {isDisasterMode && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />}
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
                            {isMountainMode && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
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
                            {projection === 'globe' && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                          </div>
                          <span className={cn("text-[8px] font-bold uppercase tracking-wider text-center leading-tight", projection === 'globe' ? "text-blue-600" : "text-slate-500")}>
                            {projection === 'globe' ? 'Globe' : 'Flat'}
                          </span>
                        </button>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Map Controls (Responsive Placement) */}
      <div className={cn(
        "absolute z-40 flex flex-col gap-2 md:gap-1.5 pointer-events-none transition-all duration-500 items-end",
        // Position: Tight bottom right, moved lower for PC as requested
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
                    map.current?.setBearing(0);
                    setMapBearing(0);
                  }}
                  className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center relative overflow-hidden"
                  title="コンパスをリセット"
                >
                  <div 
                    className="relative w-6 h-6 md:w-5 md:h-5 transition-transform duration-300 ease-out"
                    style={{ transform: `rotate(${-mapBearing}deg)` }}
                  >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 md:h-2.5 bg-red-500 rounded-full" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 md:h-2.5 bg-slate-400 rounded-full" />
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
              className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center group hover:bg-slate-50 transition-all"
              title="レイヤー"
            >
              <Layers className="w-4.5 h-4.5 md:w-4 md:h-4 text-slate-600" />
            </button>
          </div>

          {/* Help Button Removed from here as it is moved to Settings */}

          {/* Locate Button (Geocoding / My Location) */}
          <div className="pointer-events-auto mb-1.5 md:mb-1.5 relative">
            <button 
              onClick={toggleTracking}
              className={cn(
                "w-9 h-9 md:w-8 md:h-8 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center transition-all active:scale-95 group relative",
                isTracking ? "text-blue-600 border-blue-200" : "text-slate-600"
              )}
              title="現在地表示"
            >
              <LocateFixed className={cn("w-4.5 h-4.5 md:w-4 md:h-4", (isTracking || isLocating) && "animate-pulse")} />
            </button>
          </div>

          {/* Zoom Controls (PC only - Request 4: Smaller) */}
          <div className="hidden md:flex flex-col bg-white rounded-lg shadow-lg border border-slate-200 pointer-events-auto overflow-hidden">
            <button 
              onClick={() => map.current?.zoomIn()}
              className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 transition-colors border-b border-slate-100 text-slate-600"
              title="拡大"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => map.current?.zoomOut()}
              className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-600"
              title="縮小"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

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
      <AnimatePresence mode="wait">
        {showSaved && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSaved(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350, mass: 1 }}
              className="fixed right-0 top-0 bottom-0 w-80 md:w-80 bg-white/95 backdrop-blur-xl shadow-2xl z-[111] border-l border-white/20 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl text-white shadow-lg transition-colors",
                    savedTab === 'agid' ? "bg-blue-600 shadow-blue-100" : "bg-emerald-600 shadow-emerald-100"
                  )}>
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
                  onClick={() => setShowSaved(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-1 px-1.5 bg-slate-100/50 m-4 rounded-xl border border-slate-200/50 flex">
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

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {savedTab === 'agid' ? (
                  <>
                    <div className="sticky top-0 z-10 bg-white pb-2">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={t('search_agid_placeholder')}
                          value={savedSearch}
                          onChange={(e) => setSavedSearch(e.target.value)}
                          className="w-full bg-slate-50 px-4 py-2 pl-10 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    {savedAgids.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
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
                            className="group bg-slate-50 rounded-2xl border border-slate-100 p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-all shadow-sm"
                          >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-black text-blue-600 font-mono">{saved.id.slice(0, 2)}</span>
                              <span className="text-xl font-bold text-slate-700 font-mono">{saved.id.slice(2)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => copyToClipboard(saved.id, 'saved-list-' + saved.id)}
                                className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-all shadow-sm"
                                title="Copy AGID"
                              >
                                <BookOpen className={cn("w-4 h-4", copied === ('saved-list-' + saved.id) ? "text-green-500" : "")} />
                              </button>
                              <button 
                                onClick={() => deleteSavedAgid(saved.id)}
                                className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-600 transition-all shadow-sm"
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
                          className="w-full bg-slate-50 px-4 py-2 pl-10 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    {aoids.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-12">
                        <ShieldIcon className="w-12 h-12 text-slate-300" />
                        <p className="text-sm font-medium text-slate-500">No AOIDs registered yet.<br/>Create private IDs for your locations.</p>
                        <button 
                          onClick={() => { setShowAddressRegistration(true); setShowSaved(false); }}
                          className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-100"
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
                            className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
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
                                setShowSaved(false);
                                setShowMenu(false);
                              }}
                              className="w-full mt-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-100 group-hover:border-emerald-200"
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

      {/* Side Menu (Resources) */}
      <AnimatePresence>
        {showResources && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
              onClick={() => setShowResources(false)}
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
                    onClick={() => setShowResources(false)}
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
                {/* Information Sections with left-aligned icons */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Database className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Global Stats</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Total Grid Points</div>
                      <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter">
                        {registryStats?.globalStats?.total?.toLocaleString() || "142M+"}
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
                    {MAJOR_CATEGORIES.map(cat => {
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
      {/* Custom Alert Modal */}
      <AnimatePresence>
        {alertConfig?.show && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAlertConfig(null)}
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
              <h3 className="text-xl font-black text-slate-900 mb-2">{alertConfig.title}</h3>
              <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">{alertConfig.message}</p>
              <button 
                onClick={() => setAlertConfig(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Dismiss
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isQrScanning && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                qrScannerRef.current?.clear();
                setIsQrScanning(false);
              }}
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

              <div id="qr-reader" className="w-full aspect-square bg-slate-100 rounded-3xl overflow-hidden border-2 border-slate-100 shadow-inner" />
              
              <button 
                onClick={() => {
                  qrScannerRef.current?.clear();
                  setIsQrScanning(false);
                }}
                className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div id="qr-reader-hidden" className="hidden" />

      {/* Center Action Button */}
      <AnimatePresence>
        {!clickedAgid && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          >
            <button 
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
              className="pointer-events-auto flex items-center justify-center gap-2 w-14 h-14 md:w-auto md:px-6 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl transition-all active:scale-95 group"
            >
              <Target className="w-7 h-7 md:w-4 md:h-4 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-widest hidden md:block whitespace-nowrap">Select Center</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  );
}

