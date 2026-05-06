import Dexie, { Table } from 'dexie';
import { fetchWestAsiaContext, RegionalLandmark } from './WestAsiaService';
import { fetchRussiaContext, RussiaContext } from './RussiaService';
import { fetchCentralAsiaContext, CentralAsiaContext } from './CentralAsiaService';
import { fetchSouthAsiaContext, SouthAsiaContext, fetchIndiaOfficialAddress } from './SouthAsiaService';
import { fetchUKIrelandContext, UKIrelandContext, fetchUKPostcodeDetails } from './UKIrelandService';
import { fetchNordicContext, NordicContext, fetchNordicWeather, fetchDanishAddress, fetchNorwegianAddress, fetchFinnishAddress } from './NordicService';
import { fetchFrenchAddress, fetchDutchAddress, fetchGermanAddress, fetchBelgianAddress, fetchSwissAddress, fetchAustrianAddress, fetchSwedishAddress, fetchEstonianAddress, fetchLatvianAddress, fetchLithuanianAddress, fetchIcelandicAddress, fetchItalianAddress, fetchSpanishAddress, fetchPortugueseAddress, fetchGreekAddress, fetchMalteseAddress, fetchCypriotAddress, fetchMicrostateAddress, fetchEEBalkanAddress, fetchBelgiumBestAddress, fetchCzechRuianAddress, fetchSpainCatastroAddress, fetchIrelandAddress, fetchLuxembourgAddress, fetchUKAddress, fetchPolishAddress } from './EuropePostalService';
import { fetchAsiaOceaniaAddress } from './AsiaOceaniaService';
import { fetchOceaniaContext, OceaniaContext } from './OceaniaService';
import { fetchEastAsiaContext, EastAsiaContext, fetchKoreaOfficialAddress, fetchHKOfficialAddress } from './EastAsiaService';
import { fetchNorthAmericaContext, NorthAmericaContext, fetchUSCensusData, fetchCanadaOfficialAddress, fetchMexicoOfficialAddress } from './NorthAmericaService';
import { fetchSouthAmericaContext, SouthAmericaContext, fetchBrazilOfficialAddress, fetchSouthAmericaOfficialAddress, fetchBrazilViaCEP } from './SouthAmericaService';
import { fetchCaribbeanContext, CaribbeanContext, fetchCaribbeanOfficialAddress } from './CaribbeanService';
import { fetchCentralAmericaContext, CentralAmericaContext, fetchCentralAmericaOfficialAddress } from './CentralAmericaService';
import { fetchSoutheastAsiaContext, SoutheastAsiaContext, fetchSoutheastAsiaOfficialAddress } from './SoutheastAsiaService';
import { fetchAfricaContext, AfricaContext, fetchAfricaOfficialAddress, fetchSouthAfricaAddress, fetchEgyptAddress } from './AfricaService';
import { fetchPolarContext, fetchPolarOfficialData, PolarContext } from './PolarService';
import { fetchNatureContext, NatureContext } from './NatureService';
import { fetchSeaContext, SeaContext } from './SeaService';
import { fetchHeritageContext, HeritageContext } from './HeritageService';
import { fetchJapaneseGeoContext, JapaneseGeoContext } from './JapaneseGeoService';
import { latLonToOSGrid } from '../lib/osgrid';

// --- Types ---

export interface OSMPlace {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat: number;
  lon: number;
  name: string;
  nameEn?: string;
  category: string;
  type_name: string;
  address?: Record<string, string>;
  tags: Record<string, string>;
  lastUpdated: number;
}

import { calculateMountainClass, calculateConsensusMetrics } from '../lib/agid';

import { fetchGlobalContext, GlobalWeather, LocalTimeInfo, fetchGlobalPostcodeDetails, fetchPlusCode } from './GlobalContextService';

export interface ParsedAddress {
  houseNumber?: string;
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  plus_code?: string | null;
  country?: string;
  poi?: string;
  elevation?: number;
  mountain_class?: number;
  confidence?: number;
  entropy?: number;
  delivery_difficulty?: string;
  flood_risk?: string;
  mountain_name?: string;
  landslide_risk?: string;
  seismic_risk?: string;
  land_cover?: string;
  global_context?: { weather: GlobalWeather | null, time: LocalTimeInfo | null };
  west_asia_context?: RegionalLandmark[];
  russia_context?: RussiaContext;
  central_asia_context?: CentralAsiaContext;
  south_asia_context?: SouthAsiaContext;
  uk_ireland_context?: UKIrelandContext;
  nordic_context?: NordicContext;
  asia_oceania_data?: any;
  oceania_context?: OceaniaContext;
  east_asia_context?: EastAsiaContext;
  north_america_context?: NorthAmericaContext;
  south_america_context?: SouthAmericaContext;
  caribbean_context?: CaribbeanContext;
  central_america_context?: CentralAmericaContext;
  southeast_asia_context?: SoutheastAsiaContext;
  africa_context?: AfricaContext;
  us_census_data?: any;
  official_regional_data?: any;
  polar_context?: PolarContext;
  polar_official_data?: any;
  nature_context?: NatureContext;
  sea_context?: SeaContext | null;
  heritage_context?: HeritageContext;
  japanese_geo_context?: JapaneseGeoContext | null;
}

// --- Database ---

class PlaceDatabase extends Dexie {
  places!: Table<OSMPlace>;

  constructor() {
    super('AGID_PlaceDB');
    this.version(1).stores({
      places: 'id, name, category, [lat+lon]'
    });
  }
}

export const db = new PlaceDatabase();

// --- Normalization & Parsing (libpostal-like) ---

/**
 * Normalizes address text by standardizing common abbreviations and formatting.
 */
export function normalizeAddress(text: string): string {
  if (!text) return "";
  
  let normalized = text.toLowerCase();
  
  // Remove punctuation
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
  
  // Standardize abbreviations (English)
  const abbreviations: Record<string, string> = {
    "st": "street",
    "rd": "road",
    "ave": "avenue",
    "blvd": "boulevard",
    "dr": "drive",
    "ln": "lane",
    "ct": "court",
    "pl": "place",
    "sq": "square",
    "apt": "apartment",
    "ste": "suite",
    "n": "north",
    "s": "south",
    "e": "east",
    "w": "west",
    "ne": "northeast",
    "nw": "northwest",
    "se": "southeast",
    "sw": "southwest"
  };

  const words = normalized.split(/\s+/);
  const mappedWords = words.map(word => abbreviations[word] || word);
  
  return mappedWords.join(" ").trim();
}

/**
 * Parses an address string into components.
 * This is a rule-based parser as a lightweight alternative to libpostal.
 */
export function parseAddress(text: string): ParsedAddress {
  const normalized = normalizeAddress(text);
  const parts: ParsedAddress = {};
  
  // Simple regex-based extraction for common patterns
  // Note: Real libpostal uses a statistical model; this is a high-quality heuristic.
  
  // Postcode (Common formats)
  const postcodeMatch = text.match(/\b\d{3}-\d{4}\b|\b\d{5}(-\d{4})?\b|\b[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}\b/i);
  if (postcodeMatch) {
    parts.postcode = postcodeMatch[0];
  }
  
  // House number (usually at start or near road)
  const houseMatch = text.match(/^\d+([a-zA-Z])?\b/);
  if (houseMatch) {
    parts.houseNumber = houseMatch[0];
  }
  
  // This is a simplified parser. In a real app, we'd use more complex logic or a library.
  // For now, we'll rely on Nominatim's structured output when possible.
  
  return parts;
}

// --- OSM Data (Overpass API) ---

import { fetchWithRetry } from '../lib/utils';

/**
 * Fetches nearby OSM places using the server-side Overpass proxy.
 */
export async function fetchNearbyOSMPlaces(lat: number, lon: number, radius: number = 500): Promise<OSMPlace[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["name"](around:${radius},${lat},${lon});
      way["name"](around:${radius},${lat},${lon});
      relation["name"](around:${radius},${lat},${lon});
    );
    out center;
  `;
  
  try {
    const response = await fetchWithRetry('/api/overpass', {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Overpass Proxy error (${response.status})`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.error) errorMessage += `: ${errJson.error}`;
      } catch (e) {
        if (errorText) errorMessage += `: ${errorText.substring(0, 100)}`;
      }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    if (!data.elements) return [];

    const places: OSMPlace[] = data.elements.map((el: any) => ({
      id: el.id,
      type: el.type,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
      name: el.tags.name,
      nameEn: el.tags['name:en'],
      category: el.tags.amenity || el.tags.shop || el.tags.tourism || el.tags.leisure || 'place',
      type_name: el.tags.place || el.tags.highway || 'other',
      tags: el.tags,
      lastUpdated: Date.now()
    }));
    
    // Save to local DB
    if (places.length > 0) {
      await db.places.bulkPut(places);
    }
    
    return places;
  } catch (error) {
    console.error(`Failed to fetch from Overpass Proxy:`, error);
    return [];
  }
}

/**
 * Fetches the nearest road way and its geometry.
 */
export async function fetchNearestRoad(lat: number, lon: number, radius: number = 200): Promise<{ name: string, type: string, distance: number, point: [number, number], geometry: [number, number][] } | null> {
  const query = `
    [out:json][timeout:30];
    way["highway"](around:${radius},${lat},${lon});
    out geom;
  `;
  
  try {
    const response = await fetchWithRetry('/api/overpass', {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.elements || data.elements.length === 0) return null;

    let minDistance = Infinity;
    let nearestRoad: any = null;
    let nearestPoint: [number, number] = [0, 0];

    data.elements.forEach((way: any) => {
      if (way.type === 'way' && way.geometry) {
        way.geometry.forEach((pt: any) => {
          const d = calculateDistance(lat, lon, pt.lat, pt.lon);
          if (d < minDistance) {
            minDistance = d;
            nearestRoad = way;
            nearestPoint = [pt.lon, pt.lat];
          }
        });
      }
    });

    if (!nearestRoad) return null;

    return {
      name: nearestRoad.tags.name || 'Unnamed Road',
      type: nearestRoad.tags.highway,
      distance: minDistance,
      point: nearestPoint,
      geometry: nearestRoad.geometry.map((pt: any) => [pt.lon, pt.lat])
    };
  } catch (error) {
    console.error('Failed to fetch nearest road:', error);
    return null;
  }
}

/**
 * Calculates the distance between two points using the Haversine formula.
 * (Copied here for use within the service without importing from lib to avoid circular deps if they exist)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Search Integration ---

/**
 * Searches for a place using local DB first, then Nominatim.
 */
export async function smartSearch(query: string, lat?: number, lon?: number): Promise<any[]> {
  const normalizedQuery = normalizeAddress(query);
  
  // 1. Search Local DB
  const localResults = await db.places
    .filter(place => 
      normalizeAddress(place.name).includes(normalizedQuery) || 
      (place.nameEn && normalizeAddress(place.nameEn).includes(normalizedQuery))
    )
    .limit(5)
    .toArray();
    
  const formattedLocal = localResults.map(p => ({
    display_name: `${p.name} (${p.category})`,
    lat: p.lat.toString(),
    lon: p.lon.toString(),
    source: 'local_db',
    type: p.category
  }));
  
  // 2. Search Nominatim via Proxy
  let nominatimResults: any[] = [];
  try {
    const biasParam = lat && lon ? `&bias=${encodeURIComponent(`&viewbox=${lon-0.1},${lat+0.1},${lon+0.1},${lat-0.1}&bounded=0`)}` : '';
    const res = await fetchWithRetry(`/api/osm-search?q=${encodeURIComponent(query)}${biasParam}&limit=10`);
    if (res.ok) {
      nominatimResults = await res.json();
    }
  } catch (e) {
    console.error('Nominatim search error:', e);
  }
  
// Combine and deduplicate
  return [...formattedLocal, ...nominatimResults];
}

// --- Regional Geocoding ---

/**
 * Performs reverse geocoding using regional APIs if available, falling back to Nominatim.
 */
export async function regionalReverseGeocode(lat: number, lon: number, langCode: string, countryCode: string): Promise<any> {
  const cc = countryCode.toLowerCase();
  
  // 1. Japan (HeartRails Geo API via Proxy)
  // Only supports Japanese. If language is not Japanese, fallback to Nominatim.
  if (cc === 'jp' && langCode === 'ja') {
    try {
      const res = await fetchWithRetry(`/api/jp-heartrails?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.response && data.response.location && data.response.location.length > 0) {
          const loc = data.response.location[0];
          // Construct a Nominatim-like address object
          return {
            address: {
              country_code: 'jp',
              country: '日本',
              province: loc.prefecture,
              city: loc.city,
              suburb: loc.town,
              postcode: loc.postal
            }
          };
        }
      }
    } catch (e) {
      console.error('HeartRails API error:', e);
    }
  }

  // 2. Taiwan (NLSC API via Proxy)
  // Only supports Traditional Chinese.
  if (cc === 'tw' && langCode === 'zh-Hant') {
    try {
      const res = await fetchWithRetry(`/api/tw-nlsc?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const xmlText = await res.text();
        // Simple XML parsing
        const getTag = (tag: string) => {
          const match = xmlText.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
          return match ? match[1] : '';
        };
        const ctyName = getTag('ctyName');
        const townName = getTag('townName');
        const villageName = getTag('villageName');
        
        if (ctyName || townName) {
          return {
            address: {
              country_code: 'tw',
              country: '台灣',
              state: ctyName,
              city: townName,
              suburb: villageName
            }
          };
        }
      }
    } catch (e) {
      console.error('NLSC API error:', e);
    }
  }

  // 3. Parallel fetch for Self-Hosted Postal Code DB, Zippopotam, Nominatim, Elevation, Water Risk, and Mountains
  let localData: any = null;
  let zippoData: any = null;
  let nominatimData: any = null;
  let elevationData: any = null;
  let waterData: any = null;
  let mountainData: any = null;
  let geoRiskData: any = null;
  let westAsiaContext: RegionalLandmark[] = [];
  let russiaContext: RussiaContext | null = null;
  let centralAsiaContext: CentralAsiaContext | null = null;
  let southAsiaContext: SouthAsiaContext | null = null;
  let ukIrelandContext: UKIrelandContext | null = null;
  let nordicContext: NordicContext | null = null;
  let europeanPostalData: any = null;
  let asiaOceaniaData: any = null;
  let oceaniaContext: OceaniaContext | null = null;
  let eastAsiaContext: EastAsiaContext | null = null;
  let northAmericaContext: NorthAmericaContext | null = null;
  let southAmericaContext: SouthAmericaContext | null = null;
  let caribbeanContext: CaribbeanContext | null = null;
  let centralAmericaContext: CentralAmericaContext | null = null;
  let southeastAsiaContext: SoutheastAsiaContext | null = null;
  let africaContext: AfricaContext | null = null;
  let usCensusData: any = null;
  let officialRegionalData: any = null;
  let polarContext: PolarContext | null = null;
  let polarOfficialData: any = null;
  let natureContext: NatureContext | null = null;
  let seaContext: SeaContext | null = null;
  let heritageContext: HeritageContext | null = null;
  let japaneseGeoContext: JapaneseGeoContext | null = null;

  const westAsiaCountries = ['sa', 'ae', 'tr', 'ir', 'il', 'iq', 'sy', 'jo', 'lb', 'ye', 'om', 'kw', 'qa', 'bh'];
  const centralAsiaCountries = ['kz', 'uz', 'kg', 'tj', 'tm'];
  const southAsiaCountries = ['in', 'pk', 'bd', 'lk', 'np', 'bt', 'af', 'mv'];
  const ukIrelandCountries = ['gb', 'ie'];
  const nordicCountries = ['no', 'se', 'dk', 'fi', 'is'];
  const europeanPostalCountries = ['fr', 'nl', 'de', 'be', 'ch', 'at', 'li', 'ee', 'lv', 'lt', 'is', 'it', 'es', 'pt', 'gr', 'mt', 'cy', 'mc', 'sm', 'va', 'ad', 'ro', 'bg', 'ua', 'md', 'by', 'ru', 'rs', 'ba', 'me', 'xk', 'al', 'mk', 'pl', 'cz', 'sk', 'hu', 'si', 'hr', 'am', 'az', 'ge'];
  const asiaOceaniaCountries = ['jp', 'cn', 'kr', 'tw', 'hk', 'mo', 'mn', 'vn', 'th', 'my', 'sg', 'id', 'ph', 'kh', 'la', 'mm', 'bn', 'tl', 'au', 'nz', 'fj', 'pg', 'sb', 'vu', 'ws', 'to'];

  let results: PromiseSettledResult<any>[] = [];
  let globalContextIdx = -1;
  let plusCodeIdx = -1;
  let hkAlsIdx = -1;

  try {
    const promises: Promise<any>[] = [
      fetchWithRetry(`/api/osm-reverse?lat=${lat}&lon=${lon}&lang=${langCode}`, { timeout: 120000 }),
      fetchWithRetry(`/api/elevation?lat=${lat}&lon=${lon}`, { timeout: 120000 }),
      fetchWithRetry(`/api/water-risk?lat=${lat}&lon=${lon}`, { timeout: 120000 }),
      fetchWithRetry(`/api/mountain/nearby?lat=${lat}&lon=${lon}`, { timeout: 120000 }),
      fetchWithRetry(`/api/geological-risk?lat=${lat}&lon=${lon}`, { timeout: 120000 })
    ];

    // Only add postal code fetch if cc is a standard 2-letter land country code (e.g. 'JP', 'US').
    // Numeric codes like '74' represent sea/other regions and don't have Geonames postal data.
    if (/^[a-z]{2}$/i.test(cc)) {
      promises.unshift(fetchWithRetry(`/api/postal-code/nearest?lat=${lat}&lon=${lon}&cc=${cc}`, { timeout: 65000 }));
    } else {
      // Push a dummy promise that resolves to an empty response to maintain index alignment
      // But wait, the indices depend on the order. 
      // Actually, looking at the code later:
      // data = await results[0].value.json(); // localData (postal)
      // nominatimData = await results[1].value.json(); // nominatim
      // ...
      // So we should maintain the array length and order if the logic expects results[0] to be postal.
      promises.unshift(Promise.resolve({ ok: false }));
    }

    if (westAsiaCountries.includes(cc)) {
      promises.push(fetchWestAsiaContext(lat, lon));
    } else if (cc === 'ru') {
      promises.push(fetchRussiaContext(lat, lon));
    } else if (centralAsiaCountries.includes(cc)) {
      promises.push(fetchCentralAsiaContext(lat, lon));
    } else if (southAsiaCountries.includes(cc)) {
      promises.push(fetchSouthAsiaContext(lat, lon));
    } else if (ukIrelandCountries.includes(cc)) {
      promises.push(fetchUKIrelandContext(lat, lon));
      if (cc === 'gb') promises.push(fetchUKAddress(lat, lon));
      else if (cc === 'ie') promises.push(fetchIrelandAddress(lat, lon));
    } else if (nordicCountries.includes(cc)) {
      promises.push(fetchNordicContext(lat, lon));
      promises.push(fetchNordicWeather(lat, lon));
      if (cc === 'dk') promises.push(fetchDanishAddress(lat, lon));
      else if (cc === 'no') promises.push(fetchNorwegianAddress(lat, lon));
      else if (cc === 'fi') promises.push(fetchFinnishAddress(lat, lon));
    } else if (cc === 'fr') {
      promises.push(fetchFrenchAddress(lat, lon));
    } else if (cc === 'za') {
      promises.push(fetchSouthAfricaAddress(lat, lon));
    } else if (cc === 'eg') {
      promises.push(fetchEgyptAddress(lat, lon));
    } else if (cc === 'lu') {
      promises.push(fetchLuxembourgAddress(lat, lon));
    } else if (cc === 'nl') {
      promises.push(fetchDutchAddress(lat, lon));
    } else if (cc === 'de') {
      promises.push(fetchGermanAddress(lat, lon));
    } else if (cc === 'be') {
      promises.push(fetchBelgianAddress(lat, lon));
      promises.push(fetchBelgiumBestAddress(lat, lon));
    } else if (cc === 'ch' || cc === 'li') {
      promises.push(fetchSwissAddress(lat, lon));
    } else if (cc === 'at') {
      promises.push(fetchAustrianAddress(lat, lon));
    } else if (cc === 'se') {
      promises.push(fetchSwedishAddress(lat, lon));
    } else if (cc === 'ee') {
      promises.push(fetchEstonianAddress(lat, lon));
    } else if (cc === 'lv') {
      promises.push(fetchLatvianAddress(lat, lon));
    } else if (cc === 'lt') {
      promises.push(fetchLithuanianAddress(lat, lon));
    } else if (cc === 'is') {
      promises.push(fetchIcelandicAddress(lat, lon));
    } else if (cc === 'it') {
      promises.push(fetchItalianAddress(lat, lon));
    } else if (cc === 'es') {
      promises.push(fetchSpanishAddress(lat, lon));
      promises.push(fetchSpainCatastroAddress(lat, lon));
    } else if (cc === 'pt') {
      promises.push(fetchPortugueseAddress(lat, lon));
    } else if (cc === 'gr') {
      promises.push(fetchGreekAddress(lat, lon));
    } else if (cc === 'mt') {
      promises.push(fetchMalteseAddress(lat, lon));
    } else if (cc === 'cy') {
      promises.push(fetchCypriotAddress(lat, lon));
    } else if (['mc', 'sm', 'va', 'ad'].includes(cc)) {
      promises.push(fetchMicrostateAddress(lat, lon, cc));
    } else if (['ro', 'bg', 'ua', 'md', 'by', 'ru', 'rs', 'ba', 'me', 'xk', 'al', 'mk', 'pl', 'cz', 'sk', 'hu', 'si', 'hr', 'am', 'az', 'ge'].includes(cc)) {
      promises.push(fetchEEBalkanAddress(lat, lon, cc));
      if (cc === 'cz') {
        promises.push(fetchCzechRuianAddress(lat, lon));
      } else if (cc === 'pl') {
        promises.push(fetchPolishAddress(lat, lon));
      }
    } else if (['us', 'ca', 'mx', 'gl'].includes(cc)) {
      promises.push(fetchNorthAmericaContext(lat, lon, cc));
      if (cc === 'us') {
        promises.push(fetchUSCensusData(lat, lon));
      } else if (cc === 'ca') {
        promises.push(fetchCanadaOfficialAddress(lat, lon));
      } else if (cc === 'mx') {
        promises.push(fetchMexicoOfficialAddress(lat, lon));
      }
    } else if (cc === 'br') {
      promises.push(fetchSouthAmericaContext(lat, lon, cc));
      promises.push(fetchBrazilOfficialAddress(lat, lon));
    } else if (['ar', 'cl', 'co', 'pe', 've', 'ec', 'bo', 'py', 'uy', 'sr', 'gy', 'gf'].includes(cc)) {
      promises.push(fetchSouthAmericaContext(lat, lon, cc));
      promises.push(fetchSouthAmericaOfficialAddress(lat, lon, cc));
    } else if (['cu', 'do', 'pr', 'jm', 'tt', 'bs', 'bb', 'lc', 'gd', 'vc', 'ag', 'kn', 'dm', 'ht', 'ky', 'tc', 'vg', 'vi', 'bm', 'gp', 'mq', 'cw', 'aw', 'sx', 'bl', 'mf'].includes(cc)) {
      promises.push(fetchCaribbeanContext(lat, lon, cc));
      promises.push(fetchCaribbeanOfficialAddress(lat, lon, cc));
      if (cc === 'pr' || cc === 'vi') {
        promises.push(fetchUSCensusData(lat, lon));
      }
    } else if (['gt', 'bz', 'sv', 'hn', 'ni', 'cr', 'pa'].includes(cc)) {
      promises.push(fetchCentralAmericaContext(lat, lon, cc));
      promises.push(fetchCentralAmericaOfficialAddress(lat, lon, cc));
    } else if (['th', 'id', 'vn', 'my', 'ph', 'sg', 'mm', 'kh', 'la', 'bn', 'tl'].includes(cc)) {
      promises.push(fetchSoutheastAsiaContext(lat, lon, cc));
      promises.push(fetchSoutheastAsiaOfficialAddress(lat, lon, cc));
    } else if (['za', 'ng', 'ke', 'eg', 'ma', 'dz', 'tn', 'ly', 'sd', 'et', 'gh', 'ci', 'sn', 'ug', 'tz', 'zm', 'zw', 'na', 'bw', 'ao', 'mz', 'cm', 'ga', 'cd', 'cg', 'rw', 'bi', 'mw', 'mg', 'mu', 'sc', 'cv', 'gm', 'gn', 'sl', 'lr', 'bf', 'ne', 'td', 'ml', 'mr', 'eh', 'dj', 'er', 'so', 'sz', 'ls', 'km', 'st', 'gq', 'bj', 'tg'].includes(cc)) {
      promises.push(fetchAfricaContext(lat, lon, cc));
      promises.push(fetchAfricaOfficialAddress(lat, lon, cc));
    } else if (asiaOceaniaCountries.includes(cc)) {
      promises.push(fetchAsiaOceaniaAddress(lat, lon, cc));
      if (['au', 'nz'].includes(cc)) {
        promises.push(fetchOceaniaContext(lat, lon, cc));
      } else if (['cn', 'kr'].includes(cc)) {
        promises.push(fetchEastAsiaContext(lat, lon, cc));
        if (cc === 'cn') {
          const { fetchTiandituAddress } = await import('./EastAsiaService');
          promises.push(fetchTiandituAddress(lat, lon));
        } else if (cc === 'kr') {
          promises.push(fetchKoreaOfficialAddress(lat, lon));
        }
      }
    }

    // 4. Polar Regions (Arctic/Antarctic)
    let polarIdx = -1;
    let polarOfficialIdx = -1;
    if (lat > 60 || lat < -60) {
      polarIdx = promises.length;
      promises.push(fetchPolarContext(lat, lon).catch(() => null));
      polarOfficialIdx = promises.length;
      promises.push(fetchPolarOfficialData(lat, lon).catch(() => null));
    }

    // 5. Nature Features
    const natureIdx = promises.length;
    promises.push(fetchNatureContext(lat, lon).catch(() => ({ 
      mountains: [], beaches: [], ports: [], seas: [], deserts: [] 
    })));

    // 6. Deep Sea Context
    const seaIdx = promises.length;
    promises.push(fetchSeaContext(lat, lon, elevationData?.elevation).catch(() => null));

    // 7. World Heritage Context
    const heritageIdx = promises.length;
    promises.push(fetchHeritageContext(lat, lon).catch(() => ({ unescoSites: [], historicSites: [] })));

    // 8. Japanese Geo Context
    let japanGeoIdx = -1;
    if (cc === 'jp') {
      japanGeoIdx = promises.length;
      promises.push(fetchJapaneseGeoContext(lat, lon).catch(() => null));
    }

    // 9. Global Real-time Context (Weather & Time)
    globalContextIdx = promises.length;
    promises.push(fetchGlobalContext(lat, lon).catch(() => ({ weather: null, time: null })));

    // 10. Global Plus Code (Vital for areas without postal codes)
    plusCodeIdx = promises.length;
    promises.push(fetchPlusCode(lat, lon).catch(() => null));

    // 11. Hong Kong ALS (Official Address lookup for HK which has no postcodes)
    if (cc === 'hk') {
      hkAlsIdx = promises.length;
      promises.push(fetchHKOfficialAddress(lat, lon).catch(() => null));
    }

    results = await Promise.allSettled(promises);

    const safeJson = async (result: any) => {
      if (result.status !== 'fulfilled' || !result.value || !result.value.ok) return null;
      const contentType = result.value.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return null;
      try {
        return await result.value.json();
      } catch (e) {
        return null;
      }
    };

    localData = await safeJson(results[0]);
    nominatimData = await safeJson(results[1]);
    elevationData = await safeJson(results[2]);
    waterData = await safeJson(results[3]);
    mountainData = await safeJson(results[4]);
    geoRiskData = await safeJson(results[5]);

    // Handle Sea and Nature results
    if (results[seaIdx] && results[seaIdx].status === 'fulfilled') {
      seaContext = results[seaIdx].value;
    }
    if (results[natureIdx] && results[natureIdx].status === 'fulfilled') {
      natureContext = results[natureIdx].value;
    }

    // Handle Heritage results
    if (results[heritageIdx] && results[heritageIdx].status === 'fulfilled') {
      heritageContext = results[heritageIdx].value;
    }

    // Handle Japanese Geo results
    if (japanGeoIdx !== -1 && results[japanGeoIdx] && results[japanGeoIdx].status === 'fulfilled') {
      japaneseGeoContext = (results[japanGeoIdx] as PromiseFulfilledResult<any>).value;
    }

    // Handle Polar results
    if (polarIdx !== -1 && results[polarIdx] && results[polarIdx].status === 'fulfilled') {
      polarContext = (results[polarIdx] as PromiseFulfilledResult<any>).value;
    }
    if (polarOfficialIdx !== -1 && results[polarOfficialIdx] && results[polarOfficialIdx].status === 'fulfilled') {
      polarOfficialData = (results[polarOfficialIdx] as PromiseFulfilledResult<any>).value;
    }

    if (results[6] && results[6].status === 'fulfilled') {
      const res6 = (results[6] as PromiseFulfilledResult<any>).value;
      if (westAsiaCountries.includes(cc)) {
        westAsiaContext = res6;
        if (westAsiaContext && westAsiaContext.length > 0) {
          const mainContext = westAsiaContext[0];
          if (mainContext.type === "Dubai Makani" || mainContext.type === "Saudi National Address Point") {
            officialRegionalData = { ...officialRegionalData, ...mainContext.tags };
            // Inject building number into address if missing
            if (nominatimData && nominatimData.address && !nominatimData.address.house_number) {
              nominatimData.address.house_number = mainContext.tags?.['addr:housenumber'] || mainContext.tags?.['addr:building_number'] || mainContext.tags?.['addr:makani'];
            }
          }
        }
      } else if (cc === 'ru') {
        russiaContext = res6;
      } else if (centralAsiaCountries.includes(cc)) {
        centralAsiaContext = res6;
      } else if (southAsiaCountries.includes(cc)) {
        southAsiaContext = res6;
      } else if (ukIrelandCountries.includes(cc)) {
        ukIrelandContext = res6;
        if (results[7] && results[7].status === 'fulfilled') {
          europeanPostalData = (results[7] as PromiseFulfilledResult<any>).value;
        }
      } else if (nordicCountries.includes(cc)) {
        nordicContext = res6;
        if (results[7] && results[7].status === 'fulfilled' && nordicContext) {
          nordicContext.weather = (results[7] as PromiseFulfilledResult<any>).value;
        }
        if (results[8] && results[8].status === 'fulfilled' && nordicContext) {
          nordicContext.addressDetails = (results[8] as PromiseFulfilledResult<any>).value;
        }
      } else if (europeanPostalCountries.includes(cc)) {
        europeanPostalData = res6;
        // Merge specialized data if available
        if (cc === 'be' && results[7] && results[7].status === 'fulfilled') {
          europeanPostalData = { ...europeanPostalData, ...(results[7] as PromiseFulfilledResult<any>).value };
        } else if (cc === 'es' && results[7] && results[7].status === 'fulfilled') {
          europeanPostalData = { ...europeanPostalData, ...(results[7] as PromiseFulfilledResult<any>).value };
        } else if (cc === 'cz' && results[7] && results[7].status === 'fulfilled') {
          europeanPostalData = { ...europeanPostalData, ...(results[7] as PromiseFulfilledResult<any>).value };
        } else if (cc === 'pl' && results[7] && results[7].status === 'fulfilled') {
          europeanPostalData = { ...europeanPostalData, ...(results[7] as PromiseFulfilledResult<any>).value };
        }
      } else if (['us', 'ca', 'mx'].includes(cc)) {
        northAmericaContext = res6;
        if (cc === 'us' && results[7] && results[7].status === 'fulfilled') {
          usCensusData = (results[7] as PromiseFulfilledResult<any>).value;
        } else if (['ca', 'mx'].includes(cc) && results[7] && results[7].status === 'fulfilled') {
          officialRegionalData = (results[7] as PromiseFulfilledResult<any>).value;
        }
      } else if (cc === 'br') {
        southAmericaContext = res6;
        if (results[7] && results[7].status === 'fulfilled') {
          officialRegionalData = (results[7] as PromiseFulfilledResult<any>).value;
        }
      } else if (['ar', 'cl', 'co', 'pe', 've', 'ec', 'bo', 'py', 'uy', 'sr', 'gy'].includes(cc)) {
        southAmericaContext = res6;
        if (results[7] && results[7].status === 'fulfilled') {
          officialRegionalData = (results[7] as PromiseFulfilledResult<any>).value;
        }
      } else if (['cu', 'do', 'pr', 'jm', 'tt', 'bs', 'bb', 'lc', 'gd', 'vc', 'ag', 'kn', 'dm', 'ht', 'ky', 'tc', 'vg', 'vi', 'bm', 'gp', 'mq', 'cw', 'aw', 'sx', 'bl', 'mf'].includes(cc)) {
        caribbeanContext = res6;
        if (results[7] && results[7].status === 'fulfilled') {
          officialRegionalData = (results[7] as PromiseFulfilledResult<any>).value;
        }
        if ((cc === 'pr' || cc === 'vi') && results[8] && results[8].status === 'fulfilled') {
          usCensusData = (results[8] as PromiseFulfilledResult<any>).value;
        }
      } else if (['gt', 'bz', 'sv', 'hn', 'ni', 'cr', 'pa'].includes(cc)) {
        centralAmericaContext = res6;
        if (results[7] && results[7].status === 'fulfilled') {
          officialRegionalData = (results[7] as PromiseFulfilledResult<any>).value;
        }
      } else if (['th', 'id', 'vn', 'my', 'ph', 'sg', 'mm', 'kh', 'la', 'bn', 'tl'].includes(cc)) {
        southeastAsiaContext = res6;
        if (results[7] && results[7].status === 'fulfilled') {
          officialRegionalData = (results[7] as PromiseFulfilledResult<any>).value;
        }
      } else if (['za', 'ng', 'ke', 'eg', 'ma', 'dz', 'tn', 'ly', 'sd', 'et', 'gh', 'ci', 'sn', 'ug', 'tz', 'zm', 'zw', 'na', 'bw', 'ao', 'mz', 'cm', 'ga', 'cd', 'cg', 'rw', 'bi', 'mw', 'mg', 'mu', 'sc', 'cv', 'gm', 'gn', 'sl', 'lr', 'bf', 'ne', 'td', 'ml', 'mr', 'eh', 'dj', 'er', 'so', 'sz', 'ls', 'km', 'st', 'gq', 'bj', 'tg'].includes(cc)) {
        africaContext = res6;
        if (results[7] && results[7].status === 'fulfilled') {
          officialRegionalData = (results[7] as PromiseFulfilledResult<any>).value;
        }
      } else if (asiaOceaniaCountries.includes(cc)) {
        asiaOceaniaData = res6;
        if (['au', 'nz'].includes(cc) && results[7] && results[7].status === 'fulfilled') {
          oceaniaContext = (results[7] as PromiseFulfilledResult<any>).value;
        } else if (['cn', 'kr'].includes(cc) && results[7] && results[7].status === 'fulfilled') {
          eastAsiaContext = (results[7] as PromiseFulfilledResult<any>).value;
          // results[8] would be Tianditu for China or KoreaOfficial for Korea
          if (results[8] && results[8].status === 'fulfilled') {
            if (cc === 'cn') {
              if (asiaOceaniaData) {
                asiaOceaniaData.tiandituDetails = (results[8] as PromiseFulfilledResult<any>).value;
              } else {
                asiaOceaniaData = { tiandituDetails: (results[8] as PromiseFulfilledResult<any>).value };
              }
            } else if (cc === 'kr') {
              officialRegionalData = (results[8] as PromiseFulfilledResult<any>).value;
            }
          }
        }
      }
    }

    // If we have a postcode from Nominatim or local DB, try Zippopotam for enrichment
    const pc = nominatimData?.address?.postcode || localData?.postalCode || europeanPostalData?.postcode || nordicContext?.addressDetails?.postcode || asiaOceaniaData?.postcode;
    if (pc) {
      try {
        // For Japan, try specialized zipcloud enrichment if we have a postcode
        if (cc === 'jp') {
          const { fetchJapanPostcode } = await import('./AsiaOceaniaService');
          const jpAddr = await fetchJapanPostcode(pc.replace('-', ''));
          if (jpAddr) {
            if (asiaOceaniaData) {
              asiaOceaniaData.japanDetails = jpAddr;
            } else {
              asiaOceaniaData = { japanDetails: jpAddr };
            }
          }
        }

        // For China, try specialized postcode enrichment
        if (cc === 'cn') {
          const { fetchChinaPostcode, getChinaProvinceByPostcode } = await import('./EastAsiaService');
          const cnAddr = await fetchChinaPostcode(pc);
          const provinceHint = getChinaProvinceByPostcode(pc);
          
          if (cnAddr || provinceHint) {
            if (asiaOceaniaData) {
              asiaOceaniaData.chinaDetails = { ...cnAddr, provinceHint };
            } else {
              asiaOceaniaData = { chinaDetails: { ...cnAddr, provinceHint } };
            }
          }
        }

        // For UK, also try postcodes.io for even more detail
        if (cc === 'gb') {
          const ukPcRes = await fetchUKPostcodeDetails(pc);
          if (ukPcRes && ukIrelandContext) {
            ukIrelandContext.postcodeDetails = ukPcRes;
          } else if (ukPcRes) {
            ukIrelandContext = { landmarks: [], postcodeDetails: ukPcRes };
          }
        }

        // For Brazil, use ViaCEP for more detailed address
        if (cc === 'br') {
          const brPcRes = await fetchBrazilViaCEP(pc);
          if (brPcRes) {
            if (officialRegionalData) {
              officialRegionalData = { ...officialRegionalData, viaCEP: brPcRes };
            } else {
              officialRegionalData = { viaCEP: brPcRes };
            }
          }
        }

        // For India, use Pincode API
        if (cc === 'in') {
          const inPcRes = await fetchIndiaOfficialAddress(lat, lon, pc);
          if (inPcRes) {
            officialRegionalData = inPcRes;
          }
        }

        // Fetch Global Enrichment via Zippopotam
        const globalZippo = await fetchGlobalPostcodeDetails(cc, pc);
        if (globalZippo) {
          zippoData = globalZippo;
        }
      } catch (e) {}
    }
    
    // Add OS Grid Reference for UK
    if (cc === 'gb') {
      const grid = latLonToOSGrid(lat, lon);
      if (grid) {
        if (ukIrelandContext) {
          ukIrelandContext.osGridRef = grid.gridRef;
        } else {
          ukIrelandContext = { landmarks: [], osGridRef: grid.gridRef };
        }
      }
    }
  } catch (e) {
    console.error('API fetch error:', e);
  }

  // Calculate delivery difficulty based on elevation and water risk (mock logic for AGID integration)
  let deliveryDifficulty = 'Normal';
  if (elevationData && elevationData.elevation !== undefined) {
    const elev = elevationData.elevation;
    if (elev > 2000) deliveryDifficulty = 'Extreme (High Altitude)';
    else if (elev > 1000) deliveryDifficulty = 'Hard (Mountainous)';
    else if (elev > 500) deliveryDifficulty = 'Moderate (Hilly)';
  }

  let floodRisk = 'Low';
  if (waterData && waterData.risk_level) {
    floodRisk = waterData.risk_level;
    if (floodRisk.includes('High')) {
      deliveryDifficulty = deliveryDifficulty === 'Normal' ? 'Hard (Flood Risk)' : `Extreme (Alt + Flood)`;
    } else if (floodRisk.includes('Moderate') && deliveryDifficulty === 'Normal') {
      deliveryDifficulty = 'Moderate (Water Proximity)';
    }
  }

  // If we have Nominatim data, enrich it with our local Postal Code DB, Zippopotam, Elevation, and Flood Risk
  if (nominatimData && nominatimData.address) {
    // Nordic specialized enrichment
    if (nordicContext?.addressDetails) {
      const nAddr = nordicContext.addressDetails;
      if (!nominatimData.address.postcode && nAddr.postcode) nominatimData.address.postcode = nAddr.postcode;
      if (!nominatimData.address.city && nAddr.city) nominatimData.address.city = nAddr.city;
      if (!nominatimData.address.road && nAddr.street) nominatimData.address.road = nAddr.street;
      if (!nominatimData.address.house_number && nAddr.houseNumber) nominatimData.address.house_number = nAddr.houseNumber;
      if (!nominatimData.address.municipality && nAddr.municipality) nominatimData.address.municipality = nAddr.municipality;
    }

    // European Postal enrichment
    if (europeanPostalData) {
      if (!nominatimData.address.postcode && europeanPostalData.postcode) nominatimData.address.postcode = europeanPostalData.postcode;
      if (!nominatimData.address.city && europeanPostalData.city) nominatimData.address.city = europeanPostalData.city;
      if (!nominatimData.address.road && europeanPostalData.street) nominatimData.address.road = europeanPostalData.street;
      if (!nominatimData.address.house_number && europeanPostalData.houseNumber) nominatimData.address.house_number = europeanPostalData.houseNumber;
      if (cc === 'fr' && europeanPostalData.context) nominatimData.address.state = europeanPostalData.context;
    }

    // Asia/Oceania enrichment
    if (asiaOceaniaData) {
      if (!nominatimData.address.postcode && asiaOceaniaData.postcode) nominatimData.address.postcode = asiaOceaniaData.postcode;
      if (!nominatimData.address.city && asiaOceaniaData.city) nominatimData.address.city = asiaOceaniaData.city;
      if (!nominatimData.address.road && asiaOceaniaData.street) nominatimData.address.road = asiaOceaniaData.street;
      if (!nominatimData.address.house_number && asiaOceaniaData.houseNumber) nominatimData.address.house_number = asiaOceaniaData.houseNumber;
      if (!nominatimData.address.suburb && asiaOceaniaData.suburb) nominatimData.address.suburb = asiaOceaniaData.suburb;
      if (!nominatimData.address.state && asiaOceaniaData.state) nominatimData.address.state = asiaOceaniaData.state;
      
      // Japan specific Zipcloud & Overpass Context enrichment
      if (cc === 'jp') {
        const jp = asiaOceaniaData.japanDetails;
        const jg = japaneseGeoContext;

        if (jp) {
          if (!nominatimData.address.state) nominatimData.address.state = jp.address1;
          if (!nominatimData.address.city) nominatimData.address.city = jp.address2;
          if (!nominatimData.address.suburb) nominatimData.address.suburb = jp.address3;
          nominatimData.address.kana = `${jp.kana1} ${jp.kana2} ${jp.kana3}`;
        }

        // Overpass context is usually more precise for exact building/ward/block
        if (jg) {
          if (jg.prefecture) nominatimData.address.state = jg.prefecture;
          if (jg.city) nominatimData.address.city = jg.city;
          if (jg.ward) nominatimData.address.city_district = jg.ward;
          if (jg.town) nominatimData.address.suburb = jg.town;
          if (jg.chome) nominatimData.address.neighbourhood = jg.chome;
          if (jg.building) nominatimData.address.building = jg.building;
          
          // Special field for Japanese formatting
          nominatimData.address.jp_chome = jg.chome;
          nominatimData.address.jp_block = jg.block;
          nominatimData.address.jp_number = jg.number;
        }
      }
    }

    // Zippopotam enrichment
    if (zippoData && zippoData.places && zippoData.places.length > 0) {
      const place = zippoData.places[0];
      if (!nominatimData.address.state && place.state) nominatimData.address.state = place.state;
      if (!nominatimData.address.city && place['place name']) nominatimData.address.city = place['place name'];
    }
    
    // Fallback to local DB
    if (localData && localData.postalCode) {
      if (!nominatimData.address.postcode) nominatimData.address.postcode = localData.postalCode;
      if (!nominatimData.address.state && !nominatimData.address.province && localData.adminName1) nominatimData.address.state = localData.adminName1;
      if (!nominatimData.address.city && !nominatimData.address.town && localData.adminName2) nominatimData.address.city = localData.adminName2;
    }
    
    // Attach elevation, difficulty, flood risk, and mountain info
    if (elevationData) {
      nominatimData.elevation = elevationData.elevation;
      nominatimData.mountain_class = calculateMountainClass(elevationData.elevation);
      if (!nominatimData.official_regional_data) nominatimData.official_regional_data = {};
      nominatimData.official_regional_data.elevation_source = elevationData.source;
    }
    nominatimData.delivery_difficulty = deliveryDifficulty;
    nominatimData.flood_risk = floodRisk;
    
    if (mountainData && mountainData.peaks && mountainData.peaks.length > 0) {
      nominatimData.mountain_name = mountainData.peaks[0].name;
    }

    // Prioritize official European address data
    if (europeanPostalData) {
      if (europeanPostalData.postcode) nominatimData.address.postcode = europeanPostalData.postcode;
      if (europeanPostalData.city) nominatimData.address.city = europeanPostalData.city;
      if (europeanPostalData.street) nominatimData.address.road = europeanPostalData.street;
      if (europeanPostalData.houseNumber) nominatimData.address.house_number = europeanPostalData.houseNumber;
      if (europeanPostalData.label) nominatimData.display_name = europeanPostalData.label;
    }

    // Prioritize official Nordic address data
    if (nordicContext?.addressDetails) {
      const ad = nordicContext.addressDetails;
      if (ad.postcode) nominatimData.address.postcode = ad.postcode;
      if (ad.city) nominatimData.address.city = ad.city;
      if (ad.street) nominatimData.address.road = ad.street;
      if (ad.houseNumber) nominatimData.address.house_number = ad.houseNumber;
    }

    if (geoRiskData) {
      nominatimData.landslide_risk = geoRiskData.risks?.landslide;
      nominatimData.seismic_risk = geoRiskData.risks?.seismic;
      nominatimData.land_cover = geoRiskData.land_cover;
    }
    
    nominatimData.west_asia_context = westAsiaContext;
    nominatimData.russia_context = russiaContext;
    nominatimData.central_asia_context = centralAsiaContext;
    nominatimData.south_asia_context = southAsiaContext;
    nominatimData.uk_ireland_context = ukIrelandContext;
    nominatimData.nordic_context = nordicContext;
    nominatimData.oceania_context = oceaniaContext;
    nominatimData.east_asia_context = eastAsiaContext;
    nominatimData.north_america_context = northAmericaContext;
    nominatimData.south_america_context = southAmericaContext;
    nominatimData.caribbean_context = caribbeanContext;
    nominatimData.central_america_context = centralAmericaContext;
    nominatimData.southeast_asia_context = southeastAsiaContext;
    nominatimData.africa_context = africaContext;
    nominatimData.us_census_data = usCensusData;
    nominatimData.official_regional_data = officialRegionalData;
    nominatimData.polar_context = polarContext;
    nominatimData.polar_official_data = polarOfficialData;
    nominatimData.nature_context = natureContext;
    nominatimData.sea_context = seaContext;
    nominatimData.heritage_context = heritageContext;
    nominatimData.japanese_geo_context = japaneseGeoContext;
    
    if (globalContextIdx !== -1 && results[globalContextIdx] && results[globalContextIdx].status === 'fulfilled') {
      nominatimData.global_context = (results[globalContextIdx] as PromiseFulfilledResult<any>).value;
    }

    if (plusCodeIdx !== -1 && results[plusCodeIdx] && results[plusCodeIdx].status === 'fulfilled') {
      nominatimData.plus_code = (results[plusCodeIdx] as PromiseFulfilledResult<any>).value;
    }

    if (hkAlsIdx !== -1 && results[hkAlsIdx] && results[hkAlsIdx].status === 'fulfilled') {
      const hkData = (results[hkAlsIdx] as PromiseFulfilledResult<any>).value;
      if (hkData) {
        nominatimData.official_regional_data = { ...nominatimData.official_regional_data, hkALS: hkData };
        // Improve search labels for countries without postcodes
        if (!nominatimData.address.suburb && hkData.district) {
          nominatimData.address.suburb = hkData.district;
        }
      }
    }
    
    return nominatimData;
  }

  // If Nominatim failed but we have local data as fallback
  if (localData && localData.postalCode) {
    const finalOfficialData = officialRegionalData || {};
    if (elevationData) finalOfficialData.elevation_source = elevationData.source;

    return {
      elevation: elevationData?.elevation,
      delivery_difficulty: deliveryDifficulty,
      plus_code: (results[plusCodeIdx] && results[plusCodeIdx].status === 'fulfilled') ? (results[plusCodeIdx] as PromiseFulfilledResult<any>).value : null,
      flood_risk: floodRisk,
      mountain_name: mountainData?.peaks?.[0]?.name,
      landslide_risk: geoRiskData?.risks?.landslide,
      seismic_risk: geoRiskData?.risks?.seismic,
      land_cover: geoRiskData?.land_cover,
      west_asia_context: westAsiaContext,
      russia_context: russiaContext,
      central_asia_context: centralAsiaContext,
      south_asia_context: southAsiaContext,
      uk_ireland_context: ukIrelandContext,
      nordic_context: nordicContext,
      european_postal_data: europeanPostalData,
      asia_oceania_data: asiaOceaniaData,
      oceania_context: oceaniaContext,
      east_asia_context: eastAsiaContext,
      north_america_context: northAmericaContext,
      south_america_context: southAmericaContext,
      caribbean_context: caribbeanContext,
      central_america_context: centralAmericaContext,
      southeast_asia_context: southeastAsiaContext,
      africa_context: africaContext,
      us_census_data: usCensusData,
      official_regional_data: finalOfficialData,
      polar_context: polarContext,
      polar_official_data: polarOfficialData,
      nature_context: natureContext,
      sea_context: seaContext,
      heritage_context: heritageContext,
      address: {
        country_code: localData.countryCode.toLowerCase(),
        country: localData.countryCode,
        state: localData.adminName1,
        city: localData.adminName2 || localData.placeName,
        suburb: localData.adminName3 || (localData.adminName2 ? localData.placeName : ''),
        postcode: localData.postalCode
      }
    };
  }

  // If all address APIs failed but we have elevation/water risk, at least return that
  if (elevationData || waterData) {
    return {
      elevation: elevationData?.elevation,
      delivery_difficulty: deliveryDifficulty,
      plus_code: (results[plusCodeIdx] && results[plusCodeIdx].status === 'fulfilled') ? (results[plusCodeIdx] as PromiseFulfilledResult<any>).value : null,
      flood_risk: floodRisk,
      mountain_name: mountainData?.peaks?.[0]?.name,
      landslide_risk: geoRiskData?.risks?.landslide,
      seismic_risk: geoRiskData?.risks?.seismic,
      land_cover: geoRiskData?.land_cover,
      address: {}
    };
  }

  return null;
}
