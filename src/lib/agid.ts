/**
 * AGID (Address Grid ID) Complete Mathematical Definition Implementation
 * Global, CORDIC-rotated, Polar-ready, 12-character format.
 */

import { COUNTRIES } from '../constants/countries';

const BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const NUMBERS = "0123456789";
const LETTERS = "ABCDEFGHJKMNPQRSTVWXYZ"; // 22 letters

const OPEN_OCEAN_CODES = 220; // 22 Letters * 10 Numbers
const COASTAL_SEA_CODES = 220; // 10 Numbers * 22 Letters
const OTHER_CODES = 100; // 10 Numbers * 10 Numbers

export const K = 12960000; // 360 deg * 3600 seconds * 10 (0.1 arc-second divisions)
export const M = 12959999; 

/**
 * Orthogonal Global Grid Projection (Equirectangular)
 * Maps Lat/Lon to a perfectly squared grid using 0.1 arc-second resolution (~3m).
 */
function getQuantized(lat: number, lon: number) {
  const qx = Math.floor(((lon + 180) / 360) * K);
  const qy = Math.floor(((lat + 90) / 180) * (K / 2));
  return { 
    qx: Math.max(0, Math.min(M, qx)), 
    qy: Math.max(0, Math.min(Math.floor(M / 2), qy)) 
  };
}

/**
 * Prefix Generation Logic (2-character Alphanumeric)
 * Rules:
 * - Open Ocean (5 Big Oceans): Alpha + Number (e.g., A1)
 * - Coastal Seas (Marginal Seas): Number + Alpha (e.g., 1A)
 * - Other/Land: Number + Number (e.g., 11)
 * - Alpha + Alpha is forbidden.
 */
function get2CharPrefix(val: number, category: 'OPEN' | 'COASTAL' | 'OTHER'): string {
  if (category === 'OPEN') {
    const v = val % OPEN_OCEAN_CODES;
    const lIdx = Math.floor(v / 10);
    const nIdx = v % 10;
    return LETTERS[lIdx] + NUMBERS[nIdx];
  } else if (category === 'COASTAL') {
    const v = val % COASTAL_SEA_CODES;
    const nIdx = Math.floor(v / 22);
    const lIdx = v % 22;
    return NUMBERS[nIdx] + LETTERS[lIdx];
  } else {
    const v = val % OTHER_CODES;
    const n1 = Math.floor(v / 10);
    const n2 = v % 10;
    return NUMBERS[n1] + NUMBERS[n2];
  }
}

const PREFIX_CACHE: { [key: string]: string } = {};

export function generatePrefix(code: string, isSea: boolean, name: string): string {
  const cacheKey = `${code}_${isSea}`;
  if (PREFIX_CACHE[cacheKey]) return PREFIX_CACHE[cacheKey];
  
  // Categorization
  let category: 'OPEN' | 'COASTAL' | 'OTHER' = 'OTHER';
  if (isSea) {
    const isOpen = code.startsWith("O_") || ["NPAC", "NEPC", "SPAC", "SEPC", "NATL", "SATL", "NIND", "SIND", "SOUT", "ARCT"].includes(code);
    if (isOpen) {
      category = 'OPEN'; // Alpha + Number
    } else {
      // [REFINE SEA CATEGORY]
      // Big 5 Coastal: Marginal seas associated with the major oceans.
      // Other Sea: Inland or completely isolated seas.
      const isCoastalType = name.includes("Sea") || name.includes("Coast") || name.includes("Strait") || name.includes("Bay") || name.includes("Gulf") || name.includes("Inlet") || name.includes("Channel");
      const isBig5Coastal = name.includes("Pacific") || name.includes("Atlantic") || name.includes("Indian") || name.includes("Arctic") || name.includes("Southern") || isCoastalType;
      
      if (isBig5Coastal) {
        category = 'COASTAL'; // Number + Alpha
      } else {
        // Fallback for smaller bays/straits/channels that the user wants to treat as open sea grid
        category = 'OPEN'; 
      }
    }
  } else {
    // [RESTORE COUNTRY CODE]
    // If it's land and has a 2-letter ISO code, use it directly.
    // This is the ONLY case where Alpha + Alpha is allowed.
    if (code.length === 2 && /^[A-Z]{2}$/i.test(code)) {
      const countryCode = code.toUpperCase();
      PREFIX_CACHE[cacheKey] = countryCode;
      return countryCode;
    }
  }

  // Consistent Hash for prefix assignment
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = ((hash << 5) - hash) + code.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  let prefix = get2CharPrefix(hash, category);
  
  // Collision Resolution within cache
  let attempts = 0;
  while (Object.values(PREFIX_CACHE).includes(prefix) && attempts < 50) {
    prefix = get2CharPrefix(hash + attempts + 1, category);
    attempts++;
  }

  // [STRICT ALPHA-ALPHA BAN FOR SEA]
  // Fallback guard to ensure NO Sea Code is ever Alpha-Alpha.
  // 1. Sea codes MUST have at least one numeric character (from sub-category logic)
  // 2. Country codes (Alpha-Alpha) are strictly reserved for land entities.
  if (isSea && /^[A-Z]{2}$/.test(prefix)) {
    // Forced fallback to Number-Alpha (Coastal format) if categorization somehow produced Alpha-Alpha
    prefix = NUMBERS[hash % 10] + LETTERS[hash % 22];
  }
  
  // 3. land codes (without ISO) MUST be Number-Number
  if (!isSea && !/^[A-Z]{2}$/.test(prefix) && !/^[0-9]{2}$/.test(prefix)) {
    prefix = NUMBERS[hash % 10] + NUMBERS[(hash / 10 | 0) % 10];
  }
  
  PREFIX_CACHE[cacheKey] = prefix;
  return prefix;
}

/**
 * Morton Encoding (Z-order curve) - Optimized for 25-bit axes (50-bit total)
 */
function encodeMorton(x: number, y: number, bits: number): bigint {
  let morton = 0n;
  for (let i = 0; i < bits; i++) {
    const bitX = BigInt((x >> i) & 1);
    const bitY = BigInt((y >> i) & 1);
    morton |= (bitX << BigInt(2 * i)) | (bitY << BigInt(2 * i + 1));
  }
  return morton;
}

function decodeMorton(morton: bigint, bits: number): { x: number, y: number } {
  let x = 0;
  let y = 0;
  for (let i = 0; i < bits; i++) {
    x |= Number((morton >> BigInt(2 * i)) & 1n) << i;
    y |= Number((morton >> BigInt(2 * i + 1)) & 1n) << i;
  }
  return { x, y };
}

/**
 * Mountain Class (UNEP-WCMC) Definition
 * Based on "地理構造.pdf" Page 30
 */
export function calculateMountainClass(elevation: number, slope: number = 0, relief: number = 0): number {
  if (elevation > 4500) return 1;
  if (elevation > 3500) return 2;
  if (elevation > 2500) return 3;
  if (elevation > 1500 && slope > 2) return 4;
  if (elevation > 1000 && (slope >= 5 || relief > 300)) return 5;
  if (elevation > 300 && relief > 300) return 6;
  return 0;
}

/**
 * Consensus Metrics (Entropy & Confidence)
 * Based on "合意.pdf" Page 9
 */
export function calculateConsensusMetrics(probabilities: Map<string, number>): { entropy: number, confidence: number } {
  let entropy = 0;
  const size = probabilities.size;
  if (size <= 1) return { entropy: 0, confidence: 1 };

  probabilities.forEach((p) => {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  });

  const maxEntropy = Math.log2(size);
  const confidence = 1 - (entropy / maxEntropy);

  return { entropy, confidence };
}

/**
 * Base32 Encoding (Fixed length)
 */
function encodeBase32(value: bigint, length: number): string {
  let result = "";
  let temp = value;
  for (let i = 0; i < length; i++) {
    const index = Number(temp % 32n);
    result = BASE32_ALPHABET[index] + result;
    temp /= 32n;
  }
  return result;
}

function decodeBase32(hash: string): bigint {
  let result = 0n;
  for (let i = 0; i < hash.length; i++) {
    const index = BASE32_ALPHABET.indexOf(hash[i]);
    if (index === -1) throw new Error(`Invalid character in AGID: ${hash[i]}`);
    result = result * 32n + BigInt(index);
  }
  return result;
}

export interface AGIDResult {
  id: string; // The prefix + hash
  prefix: string; // The 2-char alphanumeric prefix
  hash: string; // 10-char hash
  isSea: boolean;
  gridSize: number;
  regionName: string;
  regionPolygon?: number[][];
  face: number;
  lat: number;
  lon: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  polygon: number[][];
}

interface AGIDOptions {
  includePrefix?: boolean; // Setting to false skips region lookup for O(1) speed.
  isSea?: boolean; // Override sea detection manually.
}

/**
 * Core AGID Encoding
 * Redesigned for Orthogonal Global Grid (25-bit precision per axis).
 * This eliminates 'diamond' shapes and creates an axis-aligned square grid.
 */
export function encodeAGID(lat: number, lon: number): AGIDResult {
  const region = getRegionInfo(lat, lon);
  const prefix = generatePrefix(region.prefix, region.isSea, region.name);

  // 1. Quantization: Linear mapping to EQR space
  const { qx, qy } = getQuantized(lat, lon);

  // 2. Morton & Base32
  // 10 characters Base32 = 50 bits.
  // Using 25 bits for Lon (X) and 25 bits for Lat (Y).
  const packedValue = encodeMorton(qx, qy, 25);
  const hash = encodeBase32(packedValue, 10);

  return {
    id: prefix + hash,
    prefix,
    hash,
    isSea: region.isSea,
    gridSize: 3, // ~3m x 3m (0.1 arc-second) resolution
    regionName: region.name,
    regionPolygon: region.polygon,
    face: 0, // No longer using cubed sphere faces
    lat,
    lon,
    bounds: getCellBounds(qx, qy),
    polygon: getCellPolygon(qx, qy)
  };
}

/**
 * Bounds Calculation for Orthogonal Grid
 */
export function getCellPolygon(quantX: number, quantY: number, step: number = 1): number[][] {
  const minLon = (quantX / K) * 360 - 180;
  const maxLon = ((quantX + step) / K) * 360 - 180;
  const minLat = (quantY / (K / 2)) * 180 - 90;
  const maxLat = ((quantY + step) / (K / 2)) * 180 - 90;

  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat]
  ];
}

export function getCellBounds(quantX: number, quantY: number, step: number = 1) {
  const minLon = (quantX / K) * 360 - 180;
  const maxLon = ((quantX + step) / K) * 360 - 180;
  const minLat = (quantY / (K / 2)) * 180 - 90;
  const maxLat = ((quantY + step) / (K / 2)) * 180 - 90;

  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Core AGID Decoding
 */
export function decodeAGID(id: string): { lat: number, lon: number, isSea: boolean, prefix: string } | null {
  if (id.length !== 12) return null;
  const prefix = id.substring(0, 2);
  const hash = id.substring(2);

  try {
    const packedValue = decodeBase32(hash);
    const { x: quantX, y: quantY } = decodeMorton(packedValue, 25);

    const lon = (quantX / K) * 360 - 180 + (1 / (K * 2)) * 360;
    const lat = (quantY / (K / 2)) * 180 - 90 + (1 / (K)) * 180;

    return { lat, lon, isSea: false, prefix };
  } catch (e) {
    return null;
  }
}

/**
 * Advanced Global ID (AGID) Sea Regions (IHO-based)
 * Approximately 100 regions defined by bounding boxes for O(1) lookup.
 */
export const SEA_REGIONS = [
  { id: "NPAC", n: 65, s: 0, w: 100, e: 180, name: "North Pacific Ocean (West)", gridSize: 1600000, polygon: [[65,180],[65,140],[45,120],[25,120],[15,100],[0,100],[0,180],[65,180]] },
  { id: "NEPC", n: 65, s: 0, w: -180, e: -70, name: "North Pacific Ocean (East)", gridSize: 1600000, polygon: [[65,-180],[65,-165],[60,-140],[50,-125],[20,-105],[7,-78],[0,-80],[0,-180],[65,-180]] },
  { id: "SPAC", n: 0, s: -60, w: 147, e: 180, name: "South Pacific Ocean (West)", gridSize: 1600000, polygon: [[0,180],[0,105],[-10,105],[-10,147],[-44,147],[-60,147],[-60,180],[0,180]] },
  { id: "SEPC", n: 0, s: -60, w: -180, e: -67.2, name: "South Pacific Ocean (East)", gridSize: 1600000, polygon: [[0,-180],[0,-80],[-20,-70],[-55,-67.2],[-60,-67.2],[-60,-180],[0,-180]] },
  { id: "CORL", n: -10, s: -30, w: 145, e: 165, name: "Coral Sea", gridSize: 16000, polygon: [[-10,145],[-10,160],[-25,165],[-30,155],[-25,145],[-10,145]] },
  { id: "TASM", n: -30, s: -50, w: 145, e: 175, name: "Tasman Sea", gridSize: 16000, polygon: [[-30,150],[-30,170],[-45,175],[-50,165],[-45,145],[-30,150]] },
  { id: "SOLO", n: -5, s: -12, w: 154, e: 163, name: "Solomon Sea", gridSize: 16000, polygon: [[-5,155],[-5,162],[-12,163],[-12,154],[-5,155]] },
  { id: "BISM", n: -2, s: -6, w: 142, e: 155, name: "Bismarck Sea", gridSize: 16000, polygon: [[-2,145],[-2,155],[-6,155],[-6,142],[-2,145]] },
  { id: "ARAF", n: -8, s: -13, w: 130, e: 143, name: "Arafura Sea", gridSize: 16000, polygon: [[-8,130],[-8,143],[-13,143],[-13,130],[-8,130]] },
  { id: "TIMR", n: -8, s: -15, w: 120, e: 130, name: "Timor Sea", gridSize: 16000, polygon: [[-8,120],[-8,130],[-15,130],[-15,120],[-8,120]] },
  { id: "FLOR", n: -5, s: -9, w: 117, e: 124, name: "Flores Sea", gridSize: 16000, polygon: [[-5,117],[-5,124],[-9,124],[-9,117],[-5,117]] },
  { id: "MOLU", n: 2, s: -2, w: 123, e: 128, name: "Molucca Sea", gridSize: 16000, polygon: [[2,123],[2,128],[-2,128],[-2,123],[2,123]] },
  { id: "CERM", n: -2, s: -4, w: 125, e: 131, name: "Ceram Sea", gridSize: 16000, polygon: [[-2,125],[-2,131],[-4,131],[-4,125],[-2,125]] },
  { id: "HALM", n: 1, s: -1, w: 127, e: 130, name: "Halmahera Sea", gridSize: 16000, polygon: [[1,127],[1,130],[-1,130],[-1,127],[1,127]] },
  { id: "SULU", n: 12, s: 5, w: 117, e: 123, name: "Sulu Sea", gridSize: 16000, polygon: [[5,117],[12,117],[12,123],[5,123],[5,117]] },
  { id: "SIBU", n: 13, s: 11, w: 121, e: 125, name: "Sibuyan Sea", gridSize: 16000, polygon: [[11,121],[13,121],[13,125],[11,125],[11,121]] },
  { id: "VISA", n: 12, s: 11, w: 123, e: 125, name: "Visayan Sea", gridSize: 16000, polygon: [[11,123],[12,123],[12,125],[11,125],[11,123]] },
  { id: "CAMO", n: 11, s: 10, w: 124, e: 125, name: "Camotes Sea", gridSize: 16000, polygon: [[10,124],[11,124],[11,125],[10,125],[10,124]] },
  { id: "BOHO", n: 10, s: 9, w: 123, e: 126, name: "Bohol Sea", gridSize: 16000, polygon: [[9,123],[10,123],[10,126],[9,126],[9,123]] },
  { id: "MIND", n: 9, s: 7, w: 122, e: 127, name: "Mindanao Sea", gridSize: 16000, polygon: [[7,122],[9,122],[9,127],[7,127],[7,122]] },
  { id: "SAVU", n: -8, s: -11, w: 120, e: 125, name: "Savu Sea", gridSize: 16000, polygon: [[-8,120],[-8,125],[-11,125],[-11,120],[-8,120]] },
  { id: "CALI", n: 32, s: 23, w: -115, e: -106, name: "Gulf of California", gridSize: 16000, polygon: [[23,-110],[32,-115],[32,-113],[23,-106],[23,-110]] },
  { id: "NATL", n: 65, s: 0, w: -98, e: 20, name: "North Atlantic Ocean", gridSize: 1600000, polygon: [[65,-20],[60,0],[60,20],[0,20],[0,-50],[10,-83],[20,-98],[30,-80],[45,-65],[65,-20]] },
  { id: "SATL", n: 0, s: -60, w: -67.2, e: 20, name: "South Atlantic Ocean", gridSize: 1600000, polygon: [[0,-50],[0,20],[-60,20],[-60,-67.2],[-55,-67.2],[-20,-35],[0,-50]] },
  { id: "STLA", n: 52, s: 45, w: -70, e: -55, name: "Gulf of St. Lawrence", gridSize: 16000, polygon: [[45,-70],[52,-70],[52,-55],[45,-55],[45,-70]] },
  { id: "FUND", n: 46, s: 44, w: -67, e: -64, name: "Bay of Fundy", gridSize: 16000, polygon: [[44,-67],[46,-67],[46,-64],[44,-64],[44,-67]] },
  { id: "SCOT", n: 46, s: 42, w: -66, e: -58, name: "Scotian Shelf", gridSize: 16000, polygon: [[42,-66],[46,-66],[46,-58],[42,-58],[42,-66]] },
  { id: "GRAN", n: 48, s: 43, w: -55, e: -48, name: "Grand Banks", gridSize: 16000, polygon: [[43,-55],[48,-55],[48,-48],[43,-48],[43,-55]] },
  { id: "SARG", n: 35, s: 20, w: -75, e: -40, name: "Sargasso Sea", gridSize: 16000, polygon: [[20,-75],[35,-75],[35,-40],[20,-40],[20,-75]] },
  { id: "NIND", n: 30, s: 0, w: 20, e: 100, name: "North Indian Ocean", gridSize: 1600000, polygon: [[30,32],[30,50],[25,60],[15,75],[10,95],[0,100],[0,20],[15,35],[30,32]] },
  { id: "SIND", n: 0, s: -60, w: 20, e: 147, name: "South Indian Ocean", gridSize: 1600000, polygon: [[0,20],[0,100],[-10,120],[-20,147],[-60,147],[-60,20],[-35,20],[0,20]] },
  { id: "LACC", n: 15, s: 0, w: 70, e: 80, name: "Laccadive Sea", gridSize: 16000, polygon: [[0,70],[15,70],[15,80],[0,80],[0,70]] },
  { id: "TIMO", n: -10, s: -20, w: 120, e: 130, name: "Timor Sea", gridSize: 16000, polygon: [[-10,120],[-10,130],[-20,130],[-20,120],[-10,120]] },
  { id: "ARCT", n: 90, s: 65, w: -180, e: 180, name: "Arctic Ocean", gridSize: 1600000 },
  { id: "SOUT", n: -60, s: -90, w: -180, e: 180, name: "Southern Ocean", gridSize: 1600000 },
  { id: "BARN", n: 85, s: 65, w: 20, e: 60, name: "Barents Sea", gridSize: 1600000, polygons: [[[68,20],[75,20],[82,25],[82,60],[75,60],[68,50],[68,20]], [[75,25],[80,40],[75,55],[70,50],[70,30],[75,25]]] },
  { id: "KARA", n: 85, s: 65, w: 55, e: 105, name: "Kara Sea", gridSize: 1600000, polygons: [[[70,60],[80,65],[82,80],[80,105],[72,105],[70,60]], [[75,60],[80,80],[75,100],[70,90],[70,65],[75,60]], [[70,60],[80,70],[80,100],[70,90],[70,60]]] },
  { id: "LAPT_L", n: 85, s: 65, w: 90, e: 145, name: "Laptev Sea", gridSize: 1600000, polygons: [[[72,105],[80,110],[82,130],[78,145],[72,135],[72,105]], [[75,110],[80,125],[75,140],[72,130],[72,110],[75,110]], [[70,100],[80,110],[80,140],[70,130],[70,100]]] },
  { id: "ESIB_1", n: 85, s: 65, w: 130, e: 180, name: "East Siberian Sea", gridSize: 1600000, polygons: [[[70,140],[78,145],[82,170],[80,180],[70,175],[70,140]], [[75,150],[78,170],[75,-175],[70,-175],[70,150],[75,150]], [[70,140],[80,150],[80,180],[70,170],[70,140]]] },
  { id: "CHUK_1", n: 85, s: 65, w: 170, e: -155, name: "Chukchi Sea", gridSize: 1600000, polygons: [[[65,180],[75,180],[82,-170],[75,-165],[66,-168],[65,180]], [[72,-175],[74,-165],[70,-160],[67,-170],[68,-180],[72,-175]], [[65,-180],[75,-175],[75,-160],[65,-165],[65,-180]]] },
  { id: "BEAU_L", n: 85, s: 65, w: -170, e: -120, name: "Beaufort Sea", gridSize: 1600000, polygons: [[[70,-165],[78,-160],[82,-140],[78,-125],[70,-135],[70,-165]], [[72,-155],[72,-130],[69,-130],[70,-155],[72,-155]], [[70,-150],[75,-155],[75,-125],[70,-130],[70,-150]]] },
  { id: "GREE", n: 85, s: 65, w: -130, e: 15, name: "Greenland Sea", gridSize: 1600000, polygons: [[[68,-30],[75,-35],[82,-30],[82,0],[75,10],[68,0],[68,-30]], [[75,-20],[80,-10],[75,10],[70,0],[75,-20]], [[70,-20],[80,-10],[80,10],[70,0],[70,-20]]] },
  { id: "NORW_L", n: 85, s: 60, w: -60, e: 30, name: "Norwegian Sea", gridSize: 1600000, polygons: [[[62,-5],[68,-5],[75,5],[75,20],[62,15],[62,-5]], [[70,0],[75,10],[70,20],[62,5],[65,-5],[70,0]], [[62,0],[70,10],[70,20],[62,10],[62,0]]] },
  { id: "WHIT", n: 68, s: 63, w: 32, e: 44, name: "White Sea", gridSize: 1600000, polygons: [[[64,32],[68,35],[68,44],[64,42],[64,32]]] },
  { id: "HUDS_L", n: 70, s: 51, w: -95, e: -64, name: "Hudson Bay / Strait", gridSize: 1600000, polygons: [[[51,-85],[65,-95],[70,-85],[65,-75],[55,-75],[51,-85]], [[55,-90],[63,-92],[63,-80],[55,-78],[55,-90]], [[63,-78],[63,-64],[60,-64],[60,-78],[63,-78]]] },
  { id: "BAFF", n: 78, s: 65, w: -78, e: -50, name: "Baffin Bay", gridSize: 1600000, polygons: [[[68,-65],[75,-70],[78,-55],[68,-50],[68,-65]], [[68,-70],[78,-75],[78,-55],[68,-58],[68,-70]]] },
  { id: "LINC", n: 85, s: 80, w: -100, e: -10, name: "Lincoln Sea", gridSize: 1600000, polygons: [[[80,-100],[85,-100],[85,-10],[80,-10],[80,-100]]] },
  { id: "WEDD", n: -60, s: -85, w: -60, e: 0, name: "Weddell Sea", gridSize: 1600000, polygon: [[-60,-60],[-85,-60],[-85,0],[-60,0],[-60,-60]] },
  { id: "LAZA", n: -60, s: -85, w: 0, e: 30, name: "Lazarev Sea", gridSize: 1600000, polygon: [[-60,0],[-85,0],[-85,30],[-60,30],[-60,0]] },
  { id: "RIIS", n: -60, s: -85, w: 30, e: 60, name: "Riiser-Larsen Sea", gridSize: 1600000, polygon: [[-60,30],[-85,30],[-85,60],[-60,60],[-60,30]] },
  { id: "DAVI", n: -60, s: -85, w: 60, e: 90, name: "Davis Sea", gridSize: 1600000, polygon: [[-60,60],[-85,60],[-85,90],[-60,90],[-60,60]] },
  { id: "DURV", n: -60, s: -85, w: 90, e: 120, name: "Dumont d'Urville Sea", gridSize: 1600000, polygon: [[-60,90],[-85,90],[-85,120],[-60,120],[-60,90]] },
  { id: "MAWS", n: -60, s: -85, w: 120, e: 150, name: "Mawson Sea", gridSize: 1600000, polygon: [[-60,120],[-85,120],[-85,150],[-60,150],[-60,120]] },
  { id: "ROSS", n: -60, s: -85, w: 150, e: -150, name: "Ross Sea", gridSize: 1600000, polygon: [[-60,150],[-85,150],[-85,-150],[-60,-150],[-60,150]] },
  { id: "AMUN", n: -60, s: -85, w: -150, e: -120, name: "Amundsen Sea", gridSize: 1600000, polygon: [[-60,-150],[-85,-150],[-85,-120],[-60,-120],[-60,-150]] },
  { id: "BELL", n: -60, s: -85, w: -120, e: -60, name: "Bellingshausen Sea", gridSize: 1600000, polygon: [[-60,-120],[-85,-120],[-85,-60],[-60,-60],[-60,-120]] },
  { id: "MEDT", n: 46, s: 30, w: -6, e: 36, name: "Mediterranean Sea", gridSize: 16000, polygon: [[36,-5],[45,5],[45,15],[40,20],[42,30],[35,35],[30,33],[32,15],[35,-5],[36,-5]] },
  { id: "CARB", n: 25, s: 9, w: -89, e: -59, name: "Caribbean Sea", gridSize: 16000, polygon: [[18,-88],[22,-85],[25,-80],[20,-60],[10,-60],[9,-80],[15,-89],[18,-88]] },
  { id: "GMXC", n: 30, s: 18, w: -98, e: -81, name: "Gulf of Mexico", gridSize: 16000, polygon: [[25,-98],[30,-95],[30,-85],[25,-81],[18,-90],[25,-98]] },
  { id: "REDM", n: 30, s: 12, w: 32, e: 44, name: "Red Sea", gridSize: 16000, polygon: [[30,32.5],[29.5,33],[28,34.5],[25,37],[20,39],[15,42.5],[12.5,43.5],[12,43.3],[13,42.5],[16,40],[20,38],[25,35],[28,33],[30,32.5]] },
  { id: "PGUL", n: 30, s: 24, w: 48, e: 56, name: "Persian Gulf", gridSize: 16000, polygon: [[30,48],[29.5,49],[28,51],[26.5,53],[25.5,55],[24,56.5],[24.5,54.5],[25.5,52],[27,50],[29,48.5],[30,48]] },
  { id: "BLCK", n: 47, s: 40, w: 27, e: 42, name: "Black Sea", gridSize: 16000, polygon: [[45,30],[47,35],[45,41],[42,42],[41,35],[41,28],[45,30]] },
  { id: "CASP", n: 47, s: 36, w: 46, e: 55, name: "Caspian Sea", gridSize: 16000, polygon: [[47,50],[45,53],[42,54],[40,53],[37,54],[36.5,52],[37.5,49],[40,48],[44,47],[47,50]] },
  { id: "BALT", n: 66, s: 53, w: 10, e: 30, name: "Baltic Sea", gridSize: 16000, polygon: [[60,15],[65,20],[65,25],[60,30],[55,20],[53,15],[55,10],[60,15]] },
  { id: "NTHS", n: 62, s: 51, w: -4, e: 9, name: "North Sea", gridSize: 16000, polygon: [[62,-4],[62,5],[55,9],[51,2],[53,-4],[62,-4]] },
  { id: "HUDB", n: 70, s: 51, w: -95, e: -70, name: "Hudson Bay", gridSize: 16000, polygon: [[65,-95],[70,-85],[65,-75],[55,-75],[51,-85],[65,-95]] },
  { id: "SETO", n: 35, s: 33, w: 130, e: 136, name: "Seto Inland Sea", gridSize: 16000 },
  { id: "SJPN", n: 52, s: 33, w: 127, e: 143, name: "Sea of Japan", gridSize: 160000, polygon: [[45.5,141.9],[44,141.5],[43,141],[42,140.5],[41.4,140.1],[40.5,140],[39.1,139.8],[38,138.5],[37.5,137.3],[36,135.5],[35.5,133.2],[35,131],[34.3,129.2],[34.5,128.5],[35.1,128.6],[36,129.4],[37.5,129.1],[38.5,129.2],[40,128.5],[41,129.5],[42.5,130.7],[43,131.9],[44,134],[45,138],[45.5,141.9]] },
  { id: "SAGM", n: 35.35, s: 34.8, w: 139.1, e: 140, name: "Sagami Bay", gridSize: 1600 },
  { id: "SURU", n: 35.15, s: 34.5, w: 138.4, e: 139, name: "Suruga Bay", gridSize: 1600 },
  { id: "MUTU", n: 41.35, s: 40.8, w: 140.7, e: 141.2, name: "Mutsu Bay", gridSize: 1600 },
  { id: "ARIA", n: 33.3, s: 32.4, w: 130.1, e: 130.6, name: "Ariake Sea", gridSize: 1600 },
  { id: "HAKA", n: 33.7, s: 33.6, w: 130.3, e: 130.5, name: "Hakata Bay", gridSize: 1600 },
  { id: "KAGO", n: 31.8, s: 31.1, w: 130.4, e: 130.8, name: "Kagoshima Bay", gridSize: 1600 },
  { id: "OMUR", n: 33.1, s: 32.8, w: 129.8, e: 130.1, name: "Omura Bay", gridSize: 1600 },
  { id: "WAKA", n: 36.1, s: 35.4, w: 135.3, e: 136.2, name: "Wakasa Bay", gridSize: 1600 },
  { id: "TOYA", n: 37.1, s: 36.7, w: 137, e: 137.6, name: "Toyama Bay", gridSize: 1600 },
  { id: "FUNK", n: 42.6, s: 42, w: 140.2, e: 140.9, name: "Funka Bay", gridSize: 1600 },
  { id: "NEMU", n: 44.5, s: 43.3, w: 144.5, e: 146, name: "Nemuro Strait", gridSize: 1600 },
  { id: "TKYB", n: 35.75, s: 35, w: 139.6, e: 140.2, name: "Tokyo Bay", gridSize: 1600 },
  { id: "OSKB", n: 34.75, s: 34.2, w: 134.8, e: 135.5, name: "Osaka Bay", gridSize: 1600 },
  { id: "ISEB", n: 35.2, s: 34.4, w: 136.5, e: 137.1, name: "Ise Bay", gridSize: 1600 },
  { id: "KSMN", n: 36.6, s: 35.7, w: 140.5, e: 141.2, name: "Kashima-nada", gridSize: 1600 },
  { id: "ENSN", n: 35, s: 34.3, w: 137.2, e: 138.4, name: "Enshu-nada", gridSize: 1600 },
  { id: "KIIC", n: 34.4, s: 33.5, w: 134.7, e: 135.2, name: "Kii Channel", gridSize: 1600 },
  { id: "BUNG", n: 33.3, s: 32.2, w: 131.7, e: 132.5, name: "Bungo Channel", gridSize: 1600 },
  { id: "HIBN", n: 34.1, s: 33.8, w: 130.6, e: 131.2, name: "Hibiki-nada", gridSize: 1600 },
  { id: "GNKN", n: 34, s: 33.4, w: 129.5, e: 130.5, name: "Genkai-nada", gridSize: 1600 },
  { id: "IYON", n: 34, s: 33.4, w: 132, e: 132.8, name: "Iyo-nada", gridSize: 1600 },
  { id: "SUON", n: 34.2, s: 33.5, w: 131, e: 131.8, name: "Suo-nada", gridSize: 1600 },
  { id: "TSGS", n: 41.6, s: 41.1, w: 140.2, e: 141.3, name: "Tsugaru Strait", gridSize: 1600, polygon: [[41.5,140.3],[41.6,141],[41.3,141.3],[41.1,140.5],[41.5,140.3]] },
  { id: "TSMS", n: 35, s: 33.5, w: 128.5, e: 130.5, name: "Tsushima Strait", gridSize: 1600, polygon: [[34.8,129.2],[35,130],[34.2,130.5],[33.8,129.5],[34.8,129.2]] },
  { id: "BENG", n: 22, s: 5, w: 80, e: 95, name: "Bay of Bengal", gridSize: 160000, polygon: [[22,88],[20,92],[10,95],[5,95],[5,80],[15,80],[22,88]] },
  { id: "ARAB", n: 25, s: 0, w: 50, e: 75, name: "Arabian Sea", gridSize: 160000, polygon: [[25,60],[20,73],[10,75],[0,75],[0,50],[15,50],[25,60]] },
  { id: "ANDM", n: 15, s: 5, w: 92, e: 99, name: "Andaman Sea", gridSize: 16000, polygon: [[15,94],[13,98],[6,99],[5,95],[10,92],[15,94]] },
  { id: "ADRI", n: 46, s: 40, w: 12, e: 20, name: "Adriatic Sea", gridSize: 16000, polygon: [[45.5,13],[44,15],[41,19],[40,18.5],[42,14],[45.5,13]] },
  { id: "AEGE", n: 41, s: 35, w: 22, e: 28, name: "Aegean Sea", gridSize: 16000, polygon: [[40.5,24],[40,27],[36,28],[35,25],[37,23],[40.5,24]] },
  { id: "ENGC", n: 51, s: 48, w: -6, e: 2, name: "English Channel", gridSize: 16000, polygon: [[50.5,-5],[51,1],[50,2],[48.5,-5],[50.5,-5]] },
  { id: "BISC", n: 48, s: 43, w: -10, e: -1, name: "Bay of Biscay", gridSize: 16000, polygon: [[48,-5],[46,-1.5],[43.5,-2],[43.5,-9],[48,-5]] },
  { id: "GADA", n: 15, s: 10, w: 43, e: 52, name: "Gulf of Aden", gridSize: 16000, polygon: [[13,43],[15,50],[12,52],[10,45],[13,43]] },
  { id: "GOMA", n: 26, s: 22, w: 56, e: 60, name: "Gulf of Oman", gridSize: 16000, polygon: [[25,56.5],[26,58],[24,60],[22.5,59],[25,56.5]] },
  { id: "GUIN", n: 6, s: -5, w: -10, e: 10, name: "Gulf of Guinea", gridSize: 160000, polygon: [[6,-8],[5,5],[0,10],[-5,10],[-5,-10],[0,-10],[6,-8]] },
  { id: "MOZC", n: -11, s: -26, w: 32, e: 48, name: "Mozambique Channel", gridSize: 16000, polygon: [[-12,40],[-15,45],[-25,45],[-25,35],[-15,35],[-12,40]] },
  { id: "ALSK", n: 61, s: 50, w: -160, e: -130, name: "Gulf of Alaska", gridSize: 160000, polygon: [[60,-150],[58,-140],[55,-135],[52,-140],[55,-155],[60,-150]] },
  { id: "LABR", n: 65, s: 50, w: -65, e: -45, name: "Labrador Sea", gridSize: 16000, polygon: [[62,-60],[60,-50],[53,-48],[53,-58],[62,-60]] },
  { id: "BEAU_S1", n: 75, s: 68, w: -160, e: -125, name: "Beaufort Sea", gridSize: 16000, polygon: [[72,-155],[72,-130],[69,-130],[70,-155],[72,-155]] },
  { id: "NORW_S1", n: 75, s: 60, w: -5, e: 20, name: "Norwegian Sea", gridSize: 160000, polygon: [[70,0],[75,10],[70,20],[62,5],[65,-5],[70,0]] },
  { id: "GRLD", n: 80, s: 65, w: -45, e: 15, name: "Greenland Sea", gridSize: 160000, polygon: [[75,-20],[80,-10],[75,10],[70,0],[75,-20]] },
  { id: "BARE", n: 75, s: 68, w: 20, e: 60, name: "Barents Sea", gridSize: 160000, polygon: [[75,25],[80,40],[75,55],[70,50],[70,30],[75,25]] },
  { id: "KARA", n: 82, s: 68, w: 55, e: 105, name: "Kara Sea", gridSize: 16000, polygon: [[75,60],[80,80],[75,100],[70,90],[70,65],[75,60]] },
  { id: "LAPT_S1", n: 82, s: 70, w: 100, e: 145, name: "Laptev Sea", gridSize: 16000, polygon: [[75,110],[80,125],[75,140],[72,130],[72,110],[75,110]] },
  { id: "ESIB_2", n: 80, s: 68, w: 140, e: -170, name: "East Siberian Sea", gridSize: 16000, polygon: [[75,150],[78,170],[75,-175],[70,-175],[70,150],[75,150]] },
  { id: "CHUK_2", n: 75, s: 65, w: -180, e: -155, name: "Chukchi Sea", gridSize: 16000, polygon: [[72,-175],[74,-165],[70,-160],[67,-170],[68,-180],[72,-175]] },
  { id: "MLCS", n: 6, s: -1, w: 95, e: 105, name: "Strait of Malacca", gridSize: 1600, polygon: [[6,95],[5,98],[1,103],[-1,105],[0,102],[4,97],[6,95]] },
  { id: "HRMZ", n: 27, s: 26, w: 55, e: 57, name: "Strait of Hormuz", gridSize: 1600, polygon: [[27,56],[26.5,56.8],[26,56.2],[26.5,55.5],[27,56]] },
  { id: "GBRL", n: 36.2, s: 35.8, w: -6, e: -5, name: "Strait of Gibraltar", gridSize: 1600, polygon: [[36.1,-5.8],[36.1,-5.3],[35.9,-5.3],[35.9,-5.8],[36.1,-5.8]] },
  { id: "BABM", n: 13, s: 12, w: 43, e: 44, name: "Bab-el-Mandeb", gridSize: 1600, polygon: [[12.8,43.2],[12.8,43.5],[12.5,43.5],[12.5,43.2],[12.8,43.2]] },
  { id: "MGLN", n: -52, s: -55, w: -75, e: -68, name: "Strait of Magellan", gridSize: 1600 },
  { id: "COOK_S1", n: -40, s: -42, w: 174, e: 175, name: "Cook Strait", gridSize: 1600 },
  { id: "BASS", n: -38, s: -41, w: 143, e: 149, name: "Bass Strait", gridSize: 1600 },
  { id: "SFLA", n: 26, s: 23, w: -83, e: -79, name: "Straits of Florida", gridSize: 1600 },
  { id: "TAIW", n: 26, s: 22, w: 118, e: 122, name: "Taiwan Strait", gridSize: 1600 },
  { id: "OKHT", n: 63, s: 44, w: 134, e: 160, name: "Sea of Okhotsk", gridSize: 16000, polygon: [[44,144],[46,142],[50,140],[55,138],[60,140],[62,150],[60,160],[55,162],[50,156],[44,144]] },
  { id: "BERI", n: 66, s: 51, w: 160, e: -160, name: "Bering Sea", gridSize: 16000, polygon: [[52,160],[55,165],[60,170],[65,-180],[66,-170],[60,-160],[55,-165],[52,-175],[52,160]] },
  { id: "ESCH", n: 41, s: 24, w: 117, e: 131, name: "East China Sea", gridSize: 16000, polygon: [[24,120],[26,120],[30,122],[33,125],[33,130],[30,130],[25,125],[24,120]] },
  { id: "SSCH", n: 24, s: -3, w: 102, e: 121, name: "South China Sea", gridSize: 16000, polygon: [[20,110],[24,115],[24,120],[15,120],[5,115],[0,110],[5,105],[15,105],[20,110]] },
  { id: "YELW", n: 41, s: 33, w: 117, e: 127, name: "Yellow Sea", gridSize: 16000, polygon: [[33,120],[35,119],[38,118],[40,120],[40,125],[37,127],[33,125],[33,120]] },
  { id: "BOHI", n: 41, s: 37, w: 117, e: 122, name: "Bohai Sea", gridSize: 16000, polygon: [[37,118],[39,117],[41,119],[40,122],[38,121],[37,118]] },
  { id: "JAVA", n: -3, s: -9, w: 105, e: 116, name: "Java Sea", gridSize: 16000, polygon: [[-3,105],[-3,115],[-7,115],[-8,110],[-6,105],[-3,105]] },
  { id: "CELE", n: 7, s: 1, w: 118, e: 127, name: "Celebes Sea", gridSize: 16000, polygon: [[1,120],[5,118],[7,122],[5,127],[1,125],[1,120]] },
  { id: "BNDA", n: -3, s: -8, w: 123, e: 133, name: "Banda Sea", gridSize: 16000, polygon: [[-3,125],[-3,130],[-7,132],[-8,128],[-6,124],[-3,125]] },
  { id: "PHLS", n: 25, s: 4, w: 120, e: 145, name: "Philippine Sea", gridSize: 16000, polygon: [[10,125],[20,125],[25,130],[25,145],[5,145],[5,130],[10,125]] },
  { id: "SIAM", n: 14, s: 5, w: 99, e: 105, name: "Gulf of Thailand", gridSize: 16000, polygon: [[7,100],[13,100],[13,103],[10,105],[7,103],[7,100]] },
  { id: "ANDM_2", n: 15, s: 5, w: 91, e: 99, name: "Andaman Sea", gridSize: 16000, polygon: [[5,95],[10,92],[15,94],[15,98],[10,99],[5,98],[5,95]] },
  { id: "ARAB_2", n: 25, s: 0, w: 50, e: 80, name: "Arabian Sea", gridSize: 16000, polygon: [[15,55],[25,60],[25,70],[15,75],[5,70],[5,60],[15,55]] },
  { id: "MEDW", n: 45, s: 30, w: -6, e: 12, name: "Mediterranean (West)", gridSize: 16000, polygon: [[35.9,-5.6],[35.95,-4],[36,-2],[36.5,-1],[37,0],[37.5,1],[38,2],[38.8,3],[39.5,4],[40.2,5],[41,6],[42,6.8],[43,7.5],[43.5,8.2],[44,9],[43.8,9.8],[43.5,10.5],[42.8,11.2],[42,12],[40,12],[38,12],[37.5,11.5],[37,11],[36.5,11.2],[36,11.5],[35,11.8],[34,12],[33,11],[32,10],[31,10],[30,10],[30,0],[30,-5],[33,-5.5],[35.9,-5.6]] },
  { id: "MEDE", n: 45, s: 30, w: 12, e: 36, name: "Mediterranean (East)", gridSize: 16000, polygon: [[42,12],[43.5,12.5],[45,13],[45.5,13.3],[45.8,13.6],[45.4,14.3],[45,15],[44,16],[43,17],[42,18.2],[41,19.5],[40.5,19.8],[40,20],[39,21],[38,22],[37,23],[36,24],[35.5,25.5],[35,27],[35.8,28.5],[36.5,30],[36.7,32],[36.8,34],[36.4,35],[36,36],[34.5,35.5],[33,35],[32,34.5],[31,34],[31,32],[31,30],[31.5,27.5],[32,25],[32.5,22.5],[33,20],[33.5,17.5],[34,15],[36,13.5],[38,12],[40,12],[42,12]] },
  { id: "ADRS", n: 46, s: 40, w: 12, e: 20, name: "Adriatic Sea", gridSize: 160000, polygon: [[45.8,13.6],[45,15],[43,17],[41,19.5],[40,20],[40,18.5],[42,15],[44,13],[45.8,13.6]] },
  { id: "AEGN", n: 41, s: 35, w: 22, e: 28, name: "Aegean Sea", gridSize: 16000, polygon: [[35,23],[40,23],[41,25],[40,28],[36,28],[35,23]] },
  { id: "IONN", n: 40, s: 33, w: 15, e: 23, name: "Ionian Sea", gridSize: 16000, polygon: [[35,15],[40,18],[40,21],[36,23],[35,15]] },
  { id: "TYRH", n: 44, s: 38, w: 9, e: 16, name: "Tyrrhenian Sea", gridSize: 16000, polygon: [[38,10],[44,10],[44,15],[38,15],[38,10]] },
  { id: "LIGU", n: 44, s: 43, w: 7, e: 10, name: "Ligurian Sea", gridSize: 16000, polygon: [[43,7],[44.5,8],[44,10],[43,10],[43,7]] },
  { id: "ALBR", n: 37, s: 35, w: -5, e: -2, name: "Alboran Sea", gridSize: 16000, polygon: [[35,-5],[37,-5],[37,-1],[35,-1],[35,-5]] },
  { id: "MARM", n: 41, s: 40, w: 26, e: 30, name: "Sea of Marmara", gridSize: 16000, polygon: [[40.5,27],[41.2,27],[41.2,30],[40.5,30],[40.5,27]] },
  { id: "AZOV", n: 47, s: 45, w: 34, e: 39, name: "Sea of Azov", gridSize: 16000, polygon: [[45,35],[47,35],[47,39],[45,38],[45,35]] },
  { id: "BOTH", n: 66, s: 60, w: 17, e: 25, name: "Gulf of Bothnia", gridSize: 16000 },
  { id: "FINL", n: 61, s: 59, w: 22, e: 30, name: "Gulf of Finland", gridSize: 16000 },
  { id: "RIGA", n: 59, s: 57, w: 22, e: 25, name: "Gulf of Riga", gridSize: 16000 },
  { id: "SKAG", n: 59, s: 57, w: 7, e: 11, name: "Skagerrak", gridSize: 16000 },
  { id: "KATT", n: 57, s: 56, w: 10, e: 13, name: "Kattegat", gridSize: 16000 },
  { id: "ENGL", n: 51, s: 48, w: -6, e: 2, name: "English Channel", gridSize: 16000, polygon: [[50,-2],[51,1],[51,2],[49,-1],[49,-5],[50,-2]] },
  { id: "IRIS", n: 55, s: 51, w: -7, e: -3, name: "Irish Sea", gridSize: 16000, polygon: [[52,-6],[54,-6],[55,-5],[54,-3],[52,-4],[52,-6]] },
  { id: "NORW_S2", n: 71, s: 61, w: -5, e: 20, name: "Norwegian Sea", gridSize: 16000, polygon: [[62,0],[70,10],[70,20],[62,10],[62,0]] },
  { id: "GREN", n: 80, s: 65, w: -30, e: 10, name: "Greenland Sea", gridSize: 16000, polygon: [[70,-20],[80,-10],[80,10],[70,0],[70,-20]] },
  { id: "KARA", n: 80, s: 70, w: 60, e: 100, name: "Kara Sea", gridSize: 16000, polygon: [[70,60],[80,70],[80,100],[70,90],[70,60]] },
  { id: "LAPT_S2", n: 80, s: 70, w: 100, e: 140, name: "Laptev Sea", gridSize: 16000, polygon: [[70,100],[80,110],[80,140],[70,130],[70,100]] },
  { id: "ESIB_3", n: 80, s: 70, w: 140, e: 180, name: "East Siberian Sea", gridSize: 16000, polygon: [[70,140],[80,150],[80,180],[70,170],[70,140]] },
  { id: "CHUK_3", n: 75, s: 65, w: -180, e: -160, name: "Chukchi Sea", gridSize: 16000, polygon: [[65,-180],[75,-175],[75,-160],[65,-165],[65,-180]] },
  { id: "LINN", n: 85, s: 80, w: -100, e: -10, name: "Lincoln Sea", gridSize: 16000 },
  { id: "CARB_2", n: 25, s: 8, w: -89, e: -59, name: "Caribbean Sea", gridSize: 160000, polygon: [[10,-85],[15,-88],[20,-87],[22,-85],[25,-80],[25,-70],[20,-60],[15,-60],[10,-70],[10,-85]] },
  { id: "MEXG", n: 30, s: 18, w: -98, e: -80, name: "Gulf of Mexico", gridSize: 160000, polygon: [[20,-95],[25,-97],[30,-95],[30,-85],[25,-82],[20,-85],[20,-95]] },
  { id: "USEC", n: 45, s: 25, w: -82, e: -65, name: "US East Coast (Atlantic)", gridSize: 16000, polygon: [[25,-80],[26,-80.1],[28,-80.5],[30,-81],[32,-80.8],[34,-77.8],[35,-75.5],[36,-75.8],[38,-75],[40,-74],[41,-71.5],[42,-70.5],[44,-68.5],[45,-67],[45,-60],[25,-60],[25,-80]] },
  { id: "USWC", n: 50, s: 30, w: -125, e: -115, name: "US West Coast (Pacific)", gridSize: 16000, polygon: [[32.5,-117.1],[33.5,-118.2],[34.4,-120.5],[35.5,-121.2],[36.5,-121.9],[37.8,-122.5],[39,-123.7],[40.4,-124.4],[42,-124.3],[44,-124.1],[46.2,-124],[48.4,-124.7],[49,-125],[49,-130],[32,-130],[32.5,-117.1]] },
  { id: "HUDB_2", n: 64, s: 51, w: -95, e: -77, name: "Hudson Bay", gridSize: 16000, polygon: [[55,-90],[63,-92],[63,-80],[55,-78],[55,-90]] },
  { id: "BAFF_2", n: 78, s: 65, w: -78, e: -53, name: "Baffin Bay", gridSize: 16000, polygon: [[68,-70],[78,-75],[78,-55],[68,-58],[68,-70]] },
  { id: "BEAU_S2", n: 75, s: 68, w: -160, e: -120, name: "Beaufort Sea", gridSize: 16000, polygon: [[70,-150],[75,-155],[75,-125],[70,-130],[70,-150]] },
  { id: "GUIN_2", n: 5, s: -5, w: -10, e: 15, name: "Gulf of Guinea", gridSize: 16000, polygon: [[0,-5],[5,0],[5,10],[0,10],[-5,5],[-5,0],[0,-5]] },
  { id: "MOZA", n: -10, s: -25, w: 35, e: 45, name: "Mozambique Channel", gridSize: 16000, polygon: [[-12,40],[-25,35],[-25,45],[-12,45],[-12,40]] },
  { id: "GABT", n: -32, s: -40, w: 120, e: 140, name: "Great Australian Bight", gridSize: 16000, polygon: [[-32,120],[-32,140],[-40,135],[-40,125],[-32,120]] },
  { id: "COOK_S2", n: -40, s: -42, w: 174, e: 176, name: "Cook Strait", gridSize: 16000, polygon: [[-40.5,174],[-40.5,176],[-41.5,176],[-41.5,174],[-40.5,174]] },
  { id: "HEBR", n: 59, s: 56, w: -8, e: -5, name: "Sea of Hebrides", gridSize: 16000 },
  { id: "NCHN", n: 56, s: 54, w: -7, e: -5, name: "North Channel", gridSize: 16000 },
  { id: "STGE", n: 53, s: 51, w: -7, e: -5, name: "St. George's Channel", gridSize: 16000 },
  { id: "BRIS", n: 52, s: 51, w: -6, e: -3, name: "Bristol Channel", gridSize: 16000 },
  { id: "LION", n: 44, s: 42, w: 3, e: 6, name: "Gulf of Lion", gridSize: 16000 },
  { id: "GENO", n: 45, s: 43, w: 7, e: 10, name: "Gulf of Genoa", gridSize: 16000 },
  { id: "VENI", n: 46, s: 44, w: 12, e: 14, name: "Gulf of Venice", gridSize: 16000 },
  { id: "TARA", n: 41, s: 39, w: 16, e: 18, name: "Gulf of Taranto", gridSize: 16000 },
  { id: "CORI", n: 39, s: 37, w: 22, e: 24, name: "Gulf of Corinth", gridSize: 16000 },
  { id: "GABE", n: 35, s: 33, w: 10, e: 12, name: "Gulf of Gabes", gridSize: 16000 },
  { id: "HAMM", n: 37, s: 35, w: 10, e: 12, name: "Gulf of Hammamet", gridSize: 16000 },
  { id: "SIDR", n: 33, s: 30, w: 15, e: 20, name: "Gulf of Sidra", gridSize: 16000 },
  { id: "SUEZ", n: 30, s: 27, w: 32, e: 34, name: "Gulf of Suez", gridSize: 16000 },
  { id: "AQAB", n: 30, s: 28, w: 34, e: 35, name: "Gulf of Aqaba", gridSize: 16000 },
  { id: "REDS", n: 30, s: 12, w: 32, e: 44, name: "Red Sea", gridSize: 16000, polygon: [[12,43],[20,38],[28,33],[30,33],[25,40],[15,43],[12,43]] },
  { id: "ADEN", n: 15, s: 10, w: 43, e: 51, name: "Gulf of Aden", gridSize: 16000, polygon: [[12,43],[15,45],[15,51],[10,51],[12,43]] },
  { id: "PERS", n: 30, s: 24, w: 48, e: 56, name: "Persian Gulf", gridSize: 16000, polygon: [[24,52],[30,48],[30,50],[26,56],[24,52]] },
  { id: "PLAT", n: -34, s: -36, w: -60, e: -55, name: "Rio de la Plata", gridSize: 16000 },
  { id: "HUDS_S1", n: 63, s: 60, w: -78, e: -64, name: "Hudson Strait", gridSize: 16000 },
  { id: "DAVS", n: 70, s: 60, w: -65, e: -50, name: "Davis Strait", gridSize: 16000 },
  { id: "DNMK", n: 70, s: 65, w: -35, e: -25, name: "Denmark Strait", gridSize: 16000 },
  { id: "KUTC", n: 24, s: 22, w: 68, e: 71, name: "Gulf of Kutch", gridSize: 16000 },
  { id: "KHAM", n: 23, s: 20, w: 71, e: 73, name: "Gulf of Khambhat", gridSize: 16000 },
  { id: "MALA", n: 6, s: 1, w: 95, e: 104, name: "Strait of Malacca", gridSize: 16000 },
  { id: "SULU_2", n: 10, s: 5, w: 117, e: 123, name: "Sulu Sea", gridSize: 16000, polygon: [[5,118],[9,117.5],[10,122],[8,123],[6,121],[5,118]] },
  { id: "CORA", n: -5, s: -30, w: 142, e: 165, name: "Coral Sea", gridSize: 160000, polygon: [[-10,142],[-5,150],[-10,165],[-25,160],[-30,155],[-25,145],[-10,142]] },
  { id: "BOHO", n: 10, s: 8.5, w: 123, e: 125, name: "Bohol Sea", gridSize: 1600, polygon: [[10,123.5],[9.8,124.5],[9,125],[8.5,124],[9,123.2],[10,123.5]] },
  { id: "FLOR_2", n: -5, s: -9, w: 116, e: 125, name: "Flores Sea", gridSize: 16000, polygon: [[-5,116],[-6,122],[-8.5,124],[-9,119],[-8,116],[-5,116]] },
  { id: "SOLO_2", n: -4, s: -10, w: 147, e: 158, name: "Solomon Sea", gridSize: 16000, polygon: [[-5,147],[-4,155],[-8,158],[-10,153],[-10,148],[-5,147]] },
  { id: "BSMR", n: -1, s: -6, w: 143, e: 155, name: "Bismarck Sea", gridSize: 16000, polygon: [[-3,143],[-1,150],[-4,155],[-6,148],[-5,144],[-3,143]] },
  { id: "SING", n: 2, s: 1, w: 103, e: 105, name: "Singapore Strait", gridSize: 16000 },
  { id: "MAKA", n: 1, s: -6, w: 116, e: 120, name: "Makassar Strait", gridSize: 16000 },
  { id: "BALI", n: -7, s: -9, w: 114, e: 116, name: "Bali Sea", gridSize: 16000 },
  { id: "LOMB", n: -8, s: -10, w: 115, e: 117, name: "Lombok Strait", gridSize: 16000 },
  { id: "OMAN", n: 26, s: 22, w: 56, e: 60, name: "Gulf of Oman", gridSize: 16000 }
];

/**
 * Advanced Global ID (AGID) Land Regions (Continents)
 * Used as a fallback for land detection.
 */
export const LAND_REGIONS = [
  { id: "AF", n: 37.5, s: -35, w: -18, e: 51.5, name: "Africa" },
  { id: "AQ", n: -60, s: -90, w: -180, e: 180, name: "Antarctica" },
  { id: "AS", n: 77.5, s: -11, w: 26, e: 180, name: "Asia" },
  { id: "EU", n: 71.5, s: 35, w: -25, e: 60, name: "Europe" },
  { id: "NA", n: 83.5, s: 7, w: -168, e: -52, name: "North America" },
  { id: "SA", n: 13, s: -56, w: -82, e: -34, name: "South America" },
  { id: "OC", n: 30, s: -55, w: 110, e: -120, name: "Oceania" },
];

/**
 * Advanced Global ID (AGID) Country Regions
 * Bounding boxes for major countries and regions.
 */
export const COUNTRY_REGIONS = [
  // East Asia
  {
    code: "JP", name: "Japan",
    n: 45.6, s: 20.4, w: 122.9, e: 154.0,
    polygons: [
      // Main Islands (Honshu, Kyushu, Shikoku, etc.)
      [[34.5, 137.5], [35.5, 140.4], [38.3, 141.5], [41.0, 141.5], [41.5, 141.0], [40.5, 140.0], [39.1, 139.8], [37.5, 137.5], [36.0, 135.5], [35.0, 132.5], [33.5, 130.5], [34.0, 132.0], [34.5, 134.5], [34.5, 137.5]],
      // Hokkaido
      [[42.0, 140.0], [43.0, 141.0], [45.5, 141.9], [45.0, 143.0], [44.0, 145.0], [43.3, 145.8], [42.5, 143.0], [42.0, 141.0], [42.0, 140.0]],
      // Kyushu
      [[31.0, 130.5], [33.5, 129.5], [34.0, 131.0], [33.0, 131.5], [31.5, 131.5], [31.0, 130.5]],
      // Shikoku
      [[32.5, 132.5], [34.0, 133.0], [34.5, 134.5], [33.5, 134.5], [32.5, 133.0], [32.5, 132.5]],
      // Northern Territories (Etorofu, Kunashiri, Shikotan, Habomai)
      [[44.5, 146.5], [45.5, 148.5], [45.0, 149.0], [44.0, 147.0], [44.5, 146.5]],
      [[43.7, 145.4], [44.5, 146.3], [44.0, 146.5], [43.5, 145.6], [43.7, 145.4]],
      [[43.7, 146.6], [43.9, 146.9], [43.8, 147.0], [43.7, 146.7], [43.7, 146.6]],
      // Takeshima (Liancourt Rocks)
      [[37.23, 131.85], [37.25, 131.85], [37.25, 131.87], [37.23, 131.87], [37.23, 131.85]],
      // Senkaku Islands
      [[25.7, 123.4], [25.8, 123.4], [25.8, 123.7], [25.7, 123.7], [25.7, 123.4]],
      // Ryukyu Islands
      [[26.0, 127.5], [26.5, 128.0], [26.2, 128.3], [25.8, 127.8], [26.0, 127.5]]
    ]
  },
  {
    code: "KR", name: "South Korea",
    n: 38.7, s: 33.0, w: 124.0, e: 131.0,
    polygons: [[[38.6, 128.3], [37.5, 129.4], [35.0, 129.2], [34.3, 127.0], [34.5, 126.0], [36.0, 126.5], [37.7, 126.7], [38.1, 127.0], [38.6, 128.3]]]
  },
  {
    code: "KP", name: "North Korea",
    n: 43.1, s: 37.6, w: 124.1, e: 130.7,
    polygons: [[[38.6, 128.3], [42.4, 130.7], [43.1, 126.0], [42.0, 124.1], [38.0, 125.0], [37.8, 126.7], [38.1, 127.0], [38.6, 128.3]]]
  },
  {
    code: "CN", name: "China",
    n: 53.6, s: 18.1, w: 73.5, e: 134.8,
    polygons: [
      [[53.0, 125.0], [45.0, 135.0], [40.0, 124.0], [30.0, 122.0], [20.0, 110.0], [18.0, 108.0], [22.0, 100.0], [30.0, 90.0], [35.0, 75.0], [45.0, 80.0], [50.0, 100.0], [53.0, 125.0]]
    ]
  },
  {
    code: "TW", name: "Taiwan",
    n: 26.4, s: 21.8, w: 119.3, e: 122.1,
    polygons: [[[22.0, 120.5], [25.0, 120.0], [25.5, 121.5], [22.0, 121.0], [22.0, 120.5]]]
  },
  {
    code: "HK", name: "Hong Kong",
    n: 22.6, s: 22.1, w: 113.8, e: 114.5,
    polygons: [[[22.6, 114.2], [22.2, 114.4], [22.1, 113.9], [22.5, 113.8], [22.6, 114.2]]]
  },
  {
    code: "MO", name: "Macau",
    n: 22.2, s: 22.1, w: 113.5, e: 113.6,
    polygons: [[[22.2, 113.55], [22.15, 113.6], [22.1, 113.55], [22.2, 113.55]]]
  },
  {
    code: "MN", name: "Mongolia",
    n: 52.1, s: 41.5, w: 87.7, e: 119.9,
    polygons: [[[52.0, 90.0], [50.0, 115.0], [45.0, 120.0], [42.0, 110.0], [42.0, 95.0], [48.0, 88.0], [52.0, 90.0]]]
  },

  // Southeast Asia
  {
    code: "XK", name: "Kosovo",
    n: 43.3, s: 41.8, w: 20.0, e: 21.8,
    polygons: [[[43.2, 20.5], [43.0, 21.5], [42.0, 21.3], [42.0, 20.5], [43.2, 20.5]]]
  },
  {
    code: "PS", name: "Palestine",
    n: 32.6, s: 31.2, w: 34.2, e: 35.6,
    polygons: [
      [[32.5, 35.2], [32.3, 35.5], [31.5, 35.3], [31.8, 34.9], [32.5, 35.2]],
      [[31.6, 34.3], [31.5, 34.6], [31.2, 34.2], [31.4, 34.1], [31.6, 34.3]]
    ]
  },
  {
    code: "TRNC", name: "Northern Cyprus",
    n: 35.7, s: 35.0, w: 32.7, e: 34.6,
    polygons: [[[35.6, 34.0], [35.4, 34.6], [35.1, 33.8], [35.2, 32.8], [35.6, 34.0]]]
  },
  {
    code: "VN", name: "Vietnam",
    n: 23.4, s: 8.5, w: 102.1, e: 109.5,
    polygons: [
      [[23.0, 105.0], [22.0, 108.0], [17.0, 106.0], [12.0, 109.0], [8.5, 105.0], [10.0, 105.0], [23.0, 105.0]]
    ]
  },
  {
    code: "TH", name: "Thailand",
    n: 20.5, s: 5.6, w: 97.3, e: 105.7,
    polygons: [
      [[20.0, 100.0], [17.0, 105.0], [14.0, 103.0], [13.0, 100.0], [7.0, 100.0], [6.0, 102.0], [8.0, 98.0], [15.0, 98.0], [20.0, 100.0]]
    ]
  },
  {
    code: "PH", name: "Philippines",
    n: 21.1, s: 4.6, w: 116.9, e: 126.6,
    polygons: [
      [[18.5, 121.0], [18.5, 122.5], [14.0, 122.5], [13.5, 121.0], [14.0, 120.0], [17.0, 120.0], [18.5, 121.0]],
      [[9.5, 125.0], [9.5, 126.5], [6.0, 126.5], [5.5, 124.5], [7.0, 123.0], [9.5, 125.0]],
      [[11.5, 119.5], [12.0, 120.5], [9.5, 118.5], [8.0, 117.0], [11.5, 119.5]],
      [[11.0, 123.0], [11.5, 124.5], [10.0, 125.0], [10.0, 122.5], [11.0, 123.0]]
    ]
  },
  {
    code: "MY", name: "Malaysia",
    n: 7.4, s: 0.8, w: 99.6, e: 119.3,
    polygons: [
      [[7.0, 100.0], [6.0, 102.0], [2.0, 104.0], [1.0, 103.0], [1.5, 101.0], [7.0, 100.0]],
      [[5.0, 115.0], [7.4, 117.0], [4.0, 119.0], [1.0, 110.0], [5.0, 115.0]]
    ]
  },
  {
    code: "ID", name: "Indonesia",
    n: 6.1, s: -11.1, w: 94.9, e: 141.1,
    polygons: [
      [[5.5, 95.3], [3.0, 99.0], [-1.0, 101.5], [-5.0, 105.0], [-6.0, 106.0], [-3.0, 104.0], [0.0, 101.0], [5.5, 95.3]],
      [[-6.0, 106.0], [-7.5, 110.0], [-8.5, 114.3], [-8.0, 115.0], [-7.0, 113.0], [-6.0, 106.0]],
      [[4.0, 110.0], [7.0, 116.0], [1.0, 119.0], [-3.0, 117.0], [-4.1, 111.3], [4.0, 110.0]],
      [[2.0, 120.0], [2.0, 125.0], [-3.0, 125.0], [-5.5, 123.0], [-5.5, 120.0], [-3.0, 119.0], [2.0, 120.0]],
      [[-2.0, 131.0], [-1.0, 135.0], [-3.0, 141.0], [-9.0, 141.0], [-7.5, 137.5], [-4.0, 133.0], [-2.0, 131.0]]
    ]
  },
  {
    code: "SG", name: "Singapore",
    n: 1.5, s: 1.1, w: 103.6, e: 104.1,
    polygons: [[[1.5, 103.8], [1.1, 103.7], [1.3, 103.6], [1.5, 103.8]]]
  },
  {
    code: "MM", name: "Myanmar",
    n: 28.5, s: 9.6, w: 92.2, e: 101.2,
    polygons: [[[28.0, 98.0], [22.0, 101.0], [10.0, 98.0], [16.0, 97.5], [20.0, 93.0], [28.0, 98.0]]]
  },
  {
    code: "KH", name: "Cambodia",
    n: 14.7, s: 10.4, w: 102.3, e: 107.6,
    polygons: [[[14.5, 103.0], [14.5, 107.0], [11.0, 107.5], [10.5, 104.5], [14.5, 103.0]]]
  },
  {
    code: "LA", name: "Laos",
    n: 22.5, s: 13.9, w: 100.1, e: 107.7,
    polygons: [[[22.0, 102.0], [22.0, 105.0], [14.0, 106.0], [14.0, 103.0], [22.0, 102.0]]]
  },
  {
    code: "BN", name: "Brunei",
    n: 5.1, s: 4.0, w: 114.0, e: 115.4,
    polygons: [[[5.0, 114.2], [5.0, 115.3], [4.3, 115.3], [4.3, 114.2], [5.0, 114.2]]]
  },
  {
    code: "TL", name: "Timor-Leste",
    n: -8.1, s: -9.5, w: 124.0, e: 127.3,
    polygons: [[[-8.1, 125.5], [-8.3, 127.3], [-9.5, 125.0], [-8.1, 125.5]]]
  },

  // South Asia
  {
    code: "IN", name: "India",
    n: 35.5, s: 6.7, w: 68.1, e: 97.4,
    polygons: [[[35.0, 75.0], [25.0, 70.0], [10.0, 75.0], [8.0, 78.0], [20.0, 85.0], [25.0, 95.0], [35.0, 75.0]]]
  },
  {
    code: "PK", name: "Pakistan",
    n: 37.1, s: 23.6, w: 60.8, e: 77.9,
    polygons: [[[37.0, 70.0], [35.0, 75.0], [24.0, 68.0], [25.0, 62.0], [30.0, 61.0], [37.0, 70.0]]]
  },
  {
    code: "BD", name: "Bangladesh",
    n: 26.7, s: 20.6, w: 88.0, e: 92.7,
    polygons: [[[26.0, 88.0], [26.0, 92.0], [21.0, 92.0], [22.0, 89.0], [26.0, 88.0]]]
  },
  {
    code: "LK", name: "Sri Lanka",
    n: 9.9, s: 5.9, w: 79.5, e: 81.9,
    polygons: [[[9.9, 80.0], [9.0, 81.5], [7.0, 81.9], [6.0, 81.0], [6.0, 80.0], [8.0, 79.5], [9.9, 80.0]]]
  },
  {
    code: "AF", name: "Afghanistan",
    n: 38.5, s: 29.4, w: 60.5, e: 74.9,
    polygons: [[[38.0, 70.0], [35.0, 74.0], [30.0, 61.0], [35.0, 61.0], [38.0, 70.0]]]
  },
  {
    code: "NP", name: "Nepal",
    n: 30.4, s: 26.3, w: 80.1, e: 88.2,
    polygons: [[[30.0, 81.0], [30.0, 88.0], [27.0, 88.0], [26.5, 80.0], [30.0, 81.0]]]
  },
  {
    code: "BT", name: "Bhutan",
    n: 28.3, s: 26.7, w: 88.7, e: 92.1,
    polygons: [[[28.0, 89.0], [28.0, 92.0], [27.0, 92.0], [26.8, 89.0], [28.0, 89.0]]]
  },
  {
    code: "MV", name: "Maldives",
    n: 7.1, s: -0.7, w: 72.5, e: 73.8,
    polygons: [[[7.0, 73.0], [4.0, 73.5], [0.0, 73.5], [-0.5, 73.0], [0.0, 72.5], [4.0, 72.5], [7.0, 73.0]]]
  },

  // Central Asia
  {
    code: "KZ", name: "Kazakhstan",
    n: 55.4, s: 40.5, w: 46.4, e: 87.3,
    polygons: [[[55.0, 68.0], [50.0, 85.0], [42.0, 80.0], [45.0, 55.0], [47.0, 50.0], [55.0, 68.0]]]
  },
  {
    code: "UZ", name: "Uzbekistan",
    n: 45.6, s: 37.1, w: 55.9, e: 73.1,
    polygons: [[[45.0, 58.0], [45.0, 65.0], [41.0, 72.0], [37.0, 67.0], [39.0, 60.0], [45.0, 58.0]]]
  },
  {
    code: "KG", name: "Kyrgyzstan",
    n: 43.3, s: 39.2, w: 69.2, e: 80.3,
    polygons: [[[43.0, 70.0], [43.0, 78.0], [40.0, 80.0], [39.5, 74.0], [41.0, 70.0], [43.0, 70.0]]]
  },
  {
    code: "TJ", name: "Tajikistan",
    n: 41.1, s: 36.6, w: 67.3, e: 75.2,
    polygons: [[[41.0, 70.0], [39.0, 75.0], [37.0, 74.0], [37.0, 68.0], [41.0, 70.0]]]
  },
  {
    code: "TM", name: "Turkmenistan",
    n: 42.8, s: 35.1, w: 52.4, e: 66.7,
    polygons: [[[42.0, 53.0], [42.0, 60.0], [39.0, 66.0], [36.0, 61.0], [37.0, 54.0], [42.0, 53.0]]]
  },
  {
    code: "GE", name: "Georgia",
    n: 43.6, s: 41.0, w: 40.0, e: 46.8,
    polygons: [[[43.5, 40.0], [43.0, 46.0], [41.5, 46.0], [41.1, 40.0], [43.5, 40.0]]]
  },
  {
    code: "AM", name: "Armenia",
    n: 41.3, s: 38.8, w: 43.5, e: 46.6,
    polygons: [[[41.2, 44.0], [41.2, 46.5], [39.0, 46.5], [39.0, 44.0], [41.2, 44.0]]]
  },
  {
    code: "AZ", name: "Azerbaijan",
    n: 41.9, s: 38.4, w: 44.7, e: 50.6,
    polygons: [[[41.8, 45.0], [41.8, 50.5], [38.5, 50.5], [38.5, 45.0], [41.8, 45.0]]]
  },

  // Middle East
  {
    code: "IQ", name: "Iraq",
    n: 37.4, s: 29.1, w: 38.8, e: 48.6,
    polygons: [[[37.0, 43.0], [36.5, 45.0], [31.0, 48.0], [29.5, 46.5], [32.0, 41.0], [33.5, 39.0], [37.0, 43.0]]]
  },
  {
    code: "OM", name: "Oman",
    n: 26.4, s: 16.6, w: 53.0, e: 59.8,
    polygons: [[[26.0, 56.5], [24.0, 56.5], [22.5, 59.5], [17.0, 54.0], [17.5, 52.0], [24.0, 56.0], [26.0, 56.5]]]
  },
  {
    code: "YE", name: "Yemen",
    n: 19.0, s: 12.1, w: 42.5, e: 54.5,
    polygons: [[[19.0, 53.0], [17.5, 54.5], [13.0, 45.0], [12.5, 43.5], [15.0, 42.5], [19.0, 53.0]]]
  },
  {
    code: "SY", name: "Syria",
    n: 37.3, s: 32.3, w: 35.6, e: 42.4,
    polygons: [[[37.3, 37.0], [37.3, 42.3], [34.5, 41.0], [33.0, 39.0], [34.5, 36.0], [36.0, 36.0], [37.3, 37.0]]]
  },
  {
    code: "JO", name: "Jordan",
    n: 33.4, s: 29.2, w: 34.9, e: 39.3,
    polygons: [[[33.3, 36.0], [32.0, 39.0], [29.2, 36.0], [31.0, 35.0], [33.3, 36.0]]]
  },
  {
    code: "LB", name: "Lebanon",
    n: 34.7, s: 33.1, w: 35.1, e: 36.6,
    polygons: [[[34.7, 36.4], [34.0, 36.0], [33.1, 35.1], [34.0, 35.5], [34.7, 36.4]]]
  },
  {
    code: "PS", name: "Palestine",
    n: 32.5, s: 31.2, w: 34.2, e: 35.6,
    polygons: [
      [[32.5, 35.2], [32.0, 35.5], [31.5, 35.0], [32.0, 35.1], [32.5, 35.2]],
      [[31.5, 34.5], [31.3, 34.5], [31.2, 34.2], [31.5, 34.5]]
    ]
  },
  {
    code: "BH", name: "Bahrain",
    n: 26.3, s: 25.8, w: 50.4, e: 50.7,
    polygons: [[[26.3, 50.6], [25.8, 50.5], [26.0, 50.4], [26.3, 50.6]]]
  },
  {
    code: "CY", name: "Cyprus",
    n: 35.7, s: 34.5, w: 32.2, e: 34.6,
    polygons: [[[35.5, 34.0], [35.0, 34.6], [34.5, 33.0], [35.0, 32.2], [35.5, 34.0]]]
  },
  {
    code: "QA", name: "Qatar",
    n: 26.2, s: 24.5, w: 50.7, e: 51.7,
    polygons: [[[26.2, 51.3], [25.5, 51.6], [24.6, 51.3], [25.0, 50.8], [26.2, 51.3]]]
  },
  {
    code: "KW", name: "Kuwait",
    n: 30.1, s: 28.5, w: 46.5, e: 48.5,
    polygons: [[[30.1, 48.0], [29.5, 48.4], [28.5, 48.0], [29.0, 46.5], [30.1, 48.0]]]
  },
  {
    code: "SA", name: "Saudi Arabia",
    n: 32.2, s: 16.3, w: 34.4, e: 55.7,
    polygons: [[[32.0, 36.5], [31.5, 48.0], [24.0, 51.5], [17.0, 48.0], [25.0, 37.0], [32.0, 36.5]]]
  },
  {
    code: "IR", name: "Iran",
    n: 39.8, s: 25.0, w: 44.0, e: 63.4,
    polygons: [[[39.5, 45.0], [38.5, 54.0], [37.5, 61.5], [25.0, 61.5], [26.5, 57.0], [30.0, 49.0], [39.5, 45.0]]]
  },
  {
    code: "TR", name: "Turkey",
    n: 42.2, s: 35.8, w: 25.6, e: 44.9,
    polygons: [
      [[42.0, 27.0], [41.5, 35.0], [41.0, 44.0], [37.5, 44.5], [36.0, 36.0], [36.5, 27.0], [42.0, 27.0]],
      [[42.0, 26.0], [42.0, 28.0], [40.5, 28.0], [40.5, 26.0], [42.0, 26.0]]
    ]
  },
  {
    code: "AE", name: "UAE",
    n: 26.1, s: 22.6, w: 51.5, e: 56.4,
    polygons: [[[26.0, 56.0], [24.0, 55.5], [24.0, 51.5], [25.0, 53.0], [26.0, 56.0]]]
  },
  {
    code: "IL", name: "Israel",
    n: 33.3, s: 29.4, w: 34.2, e: 35.9,
    polygons: [[[33.3, 35.5], [30.0, 35.0], [29.5, 35.0], [31.0, 34.2], [33.3, 35.5]]]
  },

  // North America & Territories
  { code: "GL", n: 83.7, s: 59.7, w: -73.3, e: -11.3, name: "Greenland" },
  { code: "PM", n: 47.1, s: 46.7, w: -56.5, e: -56.1, name: "St. Pierre & Miquelon" },
  { code: "BM", n: 32.4, s: 32.2, w: -64.9, e: -64.6, name: "Bermuda" },

  // Central America & Caribbean (Smaller/Islands first)
  { code: "AW", n: 12.6, s: 12.4, w: -70.1, e: -69.8, name: "Aruba" },
  { code: "CW", n: 12.4, s: 12.0, w: -69.2, e: -68.7, name: "Curacao" },
  { code: "BQ", n: 12.3, s: 12.0, w: -68.4, e: -68.1, name: "Bonaire" },
  { code: "BQ", n: 17.5, s: 17.4, w: -63.0, e: -62.9, name: "Sint Eustatius" },
  {
    code: "BS", name: "Bahamas",
    n: 27.3, s: 20.9, w: -80.6, e: -72.7,
    polygons: [
      [[26.7, -79.0], [26.0, -77.5], [26.8, -77.5], [26.7, -79.0]], // Grand Bahama
      [[25.0, -78.2], [24.0, -77.5], [25.0, -77.5], [25.0, -78.2]], // Andros/New Providence
      [[21.0, -73.5], [21.5, -73.0], [21.3, -73.7], [21.0, -73.5]]  // Great Inagua
    ]
  },
  {
    code: "CU", name: "Cuba",
    n: 23.3, s: 19.8, w: -85.0, e: -74.1,
    polygons: [
      [[23.0, -82.0], [23.2, -80.0], [21.5, -77.0], [20.2, -74.2], [20.0, -76.0], [21.5, -79.0], [22.0, -84.5], [23.0, -84.9], [23.0, -82.0]]
    ]
  },
  {
    code: "JM", name: "Jamaica",
    n: 18.6, s: 17.7, w: -78.4, e: -76.1,
    polygons: [[[18.5, -78.3], [18.5, -76.2], [17.8, -76.2], [17.8, -78.3], [18.5, -78.3]]]
  },
  {
    code: "HT", name: "Haiti",
    n: 20.1, s: 18.0, w: -74.5, e: -71.6,
    polygons: [[[19.9, -72.7], [19.7, -71.7], [18.1, -71.7], [18.4, -74.4], [18.7, -74.4], [18.7, -72.5], [19.5, -73.5], [19.9, -72.7]]]
  },
  {
    code: "DO", name: "Dominican Republic",
    n: 20.0, s: 17.5, w: -72.0, e: -68.3,
    polygons: [[[19.9, -71.7], [18.5, -68.3], [17.5, -71.3], [18.1, -71.7], [19.7, -71.7], [19.9, -71.7]]]
  },
  {
    code: "PR", name: "Puerto Rico",
    n: 18.6, s: 17.8, w: -67.3, e: -65.2,
    polygons: [[[18.5, -67.2], [18.5, -65.6], [17.9, -65.6], [17.9, -67.2], [18.5, -67.2]]]
  },
  {
    code: "BZ", name: "Belize",
    n: 18.5, s: 15.9, w: -89.2, e: -87.4,
    polygons: [[[18.5, -88.4], [18.2, -88.1], [15.9, -88.9], [17.2, -89.1], [18.5, -88.4]]]
  },
  {
    code: "GT", name: "Guatemala",
    n: 17.8, s: 13.7, w: -92.2, e: -88.2,
    polygons: [[[17.8, -91.0], [17.8, -89.2], [15.8, -88.1], [14.0, -90.0], [14.5, -92.2], [17.8, -91.0]]]
  },
  {
    code: "SV", name: "El Salvador",
    n: 14.5, s: 13.1, w: -90.1, e: -87.7,
    polygons: [[[14.4, -89.3], [13.9, -87.7], [13.2, -87.8], [13.6, -90.1], [14.4, -89.3]]]
  },
  {
    code: "HN", name: "Honduras",
    n: 16.5, s: 13.0, w: -89.4, e: -83.1,
    polygons: [[[16.1, -86.0], [15.0, -83.1], [13.0, -87.3], [13.4, -89.3], [14.5, -89.3], [16.1, -86.0]]]
  },
  {
    code: "NI", name: "Nicaragua",
    n: 15.0, s: 10.7, w: -87.7, e: -82.6,
    polygons: [[[15.0, -85.7], [15.0, -83.2], [11.0, -83.7], [11.0, -85.8], [13.1, -87.7], [15.0, -85.7]]]
  },
  {
    code: "CR", name: "Costa Rica",
    n: 11.2, s: 8.0, w: -86.0, e: -82.5,
    polygons: [[[11.2, -85.5], [10.5, -83.5], [8.0, -83.0], [8.5, -86.0], [11.2, -85.5]]]
  },
  {
    code: "PA", name: "Panama",
    n: 9.6, s: 7.2, w: -83.1, e: -77.1,
    polygons: [[[9.6, -82.5], [9.5, -79.0], [8.4, -77.2], [7.2, -78.0], [7.5, -82.0], [9.6, -82.5]]]
  },
  { code: "TT", n: 11.4, s: 10.0, w: -61.9, e: -60.5, name: "Trinidad and Tobago" },
  { code: "BQ", n: 17.7, s: 17.6, w: -63.3, e: -63.2, name: "Saba" },
  { code: "SX", n: 18.05, s: 17.98, w: -63.15, e: -62.95, name: "Sint Maarten" },
  { code: "MF", n: 18.12, s: 18.05, w: -63.15, e: -63.00, name: "Saint Martin" },
  { code: "BL", n: 17.95, s: 17.88, w: -62.9, e: -62.8, name: "St. Barthelemy" },
  { code: "GP", n: 16.5, s: 15.8, w: -61.8, e: -61.0, name: "Guadeloupe" },
  { code: "MQ", n: 14.9, s: 14.4, w: -61.2, e: -60.8, name: "Martinique" },
  { code: "VG", n: 18.8, s: 18.3, w: -64.9, e: -64.3, name: "British Virgin Islands" },
  { code: "VI", n: 18.5, s: 17.6, w: -65.1, e: -64.5, name: "US Virgin Islands" },
  { code: "KY", n: 19.8, s: 19.2, w: -81.5, e: -79.7, name: "Cayman Islands" },
  { code: "MS", n: 16.8, s: 16.6, w: -62.3, e: -62.1, name: "Montserrat" },
  { code: "AI", n: 18.3, s: 18.1, w: -63.2, e: -62.9, name: "Anguilla" },
  { code: "AG", n: 17.7, s: 17.0, w: -61.9, e: -61.6, name: "Antigua and Barbuda" },
  { code: "KN", n: 17.4, s: 17.1, w: -62.9, e: -62.5, name: "Saint Kitts and Nevis" },
  { code: "DM", n: 15.7, s: 15.2, w: -61.5, e: -61.2, name: "Dominica" },
  { code: "LC", n: 14.1, s: 13.7, w: -61.1, e: -60.8, name: "Saint Lucia" },
  { code: "VC", n: 13.4, s: 12.5, w: -61.5, e: -61.1, name: "St. Vincent & Grenadines" },
  { code: "GD", n: 12.3, s: 11.9, w: -61.8, e: -61.6, name: "Grenada" },
  { code: "BB", n: 13.4, s: 13.0, w: -59.7, e: -59.4, name: "Barbados" },
  { code: "TC", n: 22.0, s: 21.0, w: -72.5, e: -71.0, name: "Turks and Caicos" },

  {
    code: "US", name: "USA",
    n: 71.4, s: 18.9, w: -179.2, e: -66.9,
    polygons: [
      [[49.0, -124.7], [48.4, -120.0], [49.0, -110.0], [49.0, -95.0], [45.0, -75.0], [45.0, -67.0], [25.1, -81.0], [30.0, -97.0], [32.5, -117.1], [49.0, -124.7]],
      [[71.4, -156.0], [70.0, -141.0], [60.0, -141.0], [55.0, -165.0], [60.0, -170.0], [71.4, -156.0]],
      [[22.2, -159.8], [22.3, -159.3], [19.0, -154.8], [18.9, -155.6], [22.2, -159.8]] // Hawaii
    ]
  },
  {
    code: "MX", name: "Mexico",
    n: 32.7, s: 14.5, w: -118.4, e: -86.7,
    polygons: [
      [[32.5, -117.1], [32.5, -114.7], [31.3, -111.0], [31.3, -108.2], [29.2, -104.6], [28.5, -103.5], [27.3, -101.8], [26.0, -98.3], [25.9, -97.1], [22.4, -97.8], [21.0, -97.3], [21.5, -92.5], [21.2, -86.7], [18.5, -87.5], [18.2, -88.5], [16.2, -92.2], [14.5, -92.2], [16.0, -95.0], [15.5, -97.0], [16.5, -100.0], [18.0, -103.0], [20.0, -105.5], [23.0, -106.5], [25.0, -108.0], [31.0, -115.0], [32.5, -117.1]],
      [[32.5, -117.0], [25.0, -113.0], [23.0, -110.0], [25.0, -111.0], [30.0, -114.0], [32.5, -117.0]] // Baja California
    ]
  },
  {
    code: "CA", name: "Canada",
    n: 83.1, s: 41.7, w: -141.0, e: -52.6,
    polygons: [
      [[49.0, -123.0], [55.0, -130.0], [60.0, -140.0], [69.0, -140.0], [68.0, -120.0], [68.0, -100.0], [65.0, -90.0], [65.0, -70.0], [60.0, -64.0], [50.0, -55.0], [45.0, -64.0], [45.0, -75.0], [42.0, -82.0], [46.0, -90.0], [49.0, -95.0], [49.0, -123.0]],
      [[65.0, -70.0], [70.0, -75.0], [73.0, -75.0], [73.0, -65.0], [68.0, -60.0], [65.0, -70.0]],
      [[70.0, -115.0], [73.0, -115.0], [73.0, -105.0], [69.0, -102.0], [70.0, -115.0]],
      [[78.0, -85.0], [83.0, -80.0], [83.0, -65.0], [78.0, -75.0], [78.0, -85.0]],
      [[47.0, -55.0], [51.0, -56.0], [50.0, -53.0], [47.0, -53.0], [47.0, -55.0]]
    ]
  },
  {
    code: "RU", name: "Russia",
    n: 82.0, s: 41.0, w: 19.0, e: 180.0,
    polygons: [
      [[70.0, 30.0], [80.0, 100.0], [75.0, 170.0], [65.0, 180.0], [60.0, 160.0], [50.0, 140.0], [42.0, 130.0], [50.0, 100.0], [55.0, 60.0], [50.0, 40.0], [60.0, 30.0], [70.0, 30.0]],
      [[55.3, 20.0], [55.3, 22.5], [54.4, 22.5], [54.4, 20.0], [55.3, 20.0]]
    ]
  },
  { code: "RU", n: 81.9, s: 41.2, w: -180.0, e: -168.9, name: "Russia (East)" },
  { code: "BR", n: 5.3, s: -33.8, w: -74.0, e: -34.7, name: "Brazil", polygon: [[5.0, -60.0], [0.0, -40.0], [-20.0, -40.0], [-33.0, -53.0], [-20.0, -60.0], [-10.0, -70.0], [5.0, -60.0]] },

  // Europe - High Precision Refinement
  {
    code: "GB", name: "United Kingdom",
    n: 60.9, s: 49.8, w: -8.7, e: 1.8,
    polygons: [
      [[50.0, -5.0], [55.0, -6.0], [58.5, -6.5], [58.5, -2.0], [55.0, 1.5], [51.0, 1.5], [50.0, -5.0]],
      [[55.3, -8.2], [55.3, -5.4], [54.0, -5.4], [54.0, -8.2], [55.3, -8.2]]
    ]
  },
  {
    code: "IE", name: "Ireland",
    n: 55.4, s: 51.4, w: -10.5, e: -6.0,
    polygons: [[[55.3, -8.2], [54.0, -6.0], [51.5, -6.0], [51.5, -10.0], [54.0, -10.5], [55.3, -8.2]]]
  },
  {
    code: "FR", name: "France",
    n: 51.1, s: 41.3, w: -5.1, e: 9.6,
    polygons: [
      [[51.0, 2.5], [48.5, 7.5], [44.0, 7.5], [43.0, 4.0], [43.7, 1.5], [46.0, -2.0], [48.5, -5.0], [50.0, 1.5], [51.0, 2.5]],
      [[43.0, 8.5], [43.0, 9.6], [41.3, 9.2], [41.5, 8.5], [43.0, 8.5]]
    ]
  },
  {
    code: "ES", name: "Spain",
    n: 43.8, s: 35.2, w: -19.0, e: 4.4,
    polygons: [
      [[43.5, -8.5], [43.5, -1.8], [42.5, 3.2], [39.0, 0.0], [36.0, -2.0], [36.0, -6.0], [37.0, -9.0], [42.0, -9.0], [43.5, -8.5]],
      [[40.0, 3.8], [40.0, 4.3], [38.5, 1.2], [40.0, 3.8]]
    ]
  },
  {
    code: "PT", name: "Portugal",
    n: 42.2, s: 36.9, w: -31.3, e: -6.2,
    polygons: [[[42.0, -9.0], [42.0, -6.2], [37.0, -7.5], [37.0, -9.0], [42.0, -9.0]]]
  },
  {
    code: "IT", name: "Italy",
    n: 47.1, s: 35.5, w: 6.6, e: 18.6,
    polygons: [
      [[47.0, 10.0], [46.0, 14.0], [41.0, 18.5], [38.0, 16.0], [39.0, 15.0], [41.0, 14.0], [44.0, 10.0], [45.5, 7.0], [47.0, 10.0]],
      [[38.5, 12.5], [38.5, 15.5], [36.5, 15.0], [37.0, 12.0], [38.5, 12.5]],
      [[41.3, 8.2], [41.3, 9.8], [39.0, 9.8], [39.0, 8.2], [41.3, 8.2]]
    ]
  },
  {
    code: "DE", name: "Germany",
    n: 55.1, s: 47.3, w: 5.9, e: 15.0,
    polygons: [[[55.0, 8.5], [54.5, 14.5], [51.0, 15.0], [48.0, 13.0], [47.5, 9.0], [50.0, 6.0], [53.5, 7.0], [55.0, 8.5]]]
  },
  {
    code: "CH", name: "Switzerland",
    n: 47.8, s: 45.8, w: 5.9, e: 10.5,
    polygons: [[[47.5, 9.0], [47.5, 10.5], [46.0, 10.5], [46.0, 6.0], [47.5, 9.0]]]
  },
  {
    code: "AT", name: "Austria",
    n: 49.0, s: 46.4, w: 9.5, e: 17.2,
    polygons: [[[49.0, 15.0], [49.0, 17.0], [46.5, 17.0], [46.5, 9.5], [48.0, 13.0], [49.0, 15.0]]]
  },
  {
    code: "BE", name: "Belgium",
    n: 51.5, s: 49.5, w: 2.5, e: 6.4,
    polygons: [[[51.5, 3.5], [51.5, 6.0], [49.5, 6.0], [49.5, 2.5], [51.5, 3.5]]]
  },
  {
    code: "NL", name: "Netherlands",
    n: 53.6, s: 50.7, w: 3.3, e: 7.2,
    polygons: [[[53.5, 6.0], [53.5, 7.2], [50.7, 6.0], [51.5, 3.5], [53.5, 6.0]]]
  },
  {
    code: "LU", name: "Luxembourg",
    n: 50.2, s: 49.4, w: 5.7, e: 6.5,
    polygons: [[[50.2, 6.0], [50.0, 6.5], [49.4, 6.0], [49.5, 5.7], [50.2, 6.0]]]
  },
  {
    code: "PL", name: "Poland",
    n: 54.9, s: 49.0, w: 14.1, e: 24.2,
    polygons: [[[54.9, 15.0], [54.9, 23.0], [52.0, 24.0], [49.0, 23.0], [49.0, 15.0], [52.0, 14.0], [54.9, 15.0]]]
  },
  {
    code: "CZ", name: "Czechia",
    n: 51.1, s: 48.5, w: 12.1, e: 18.9,
    polygons: [[[51.0, 14.0], [51.0, 17.0], [49.0, 18.5], [48.5, 13.0], [50.0, 12.0], [51.0, 14.0]]]
  },
  {
    code: "SK", name: "Slovakia",
    n: 49.6, s: 47.7, w: 16.8, e: 22.6,
    polygons: [[[49.5, 19.0], [49.5, 22.5], [47.7, 22.0], [47.7, 17.0], [49.5, 19.0]]]
  },
  {
    code: "HU", name: "Hungary",
    n: 48.6, s: 45.7, w: 16.1, e: 22.9,
    polygons: [[[48.5, 17.0], [48.5, 22.5], [45.7, 22.5], [45.7, 16.0], [48.5, 17.0]]]
  },
  {
    code: "RO", name: "Romania",
    n: 48.3, s: 43.6, w: 20.2, e: 29.8,
    polygons: [[[48.0, 22.0], [48.0, 28.0], [45.0, 29.5], [44.0, 28.0], [44.0, 21.0], [48.0, 22.0]]]
  },
  {
    code: "BG", name: "Bulgaria",
    n: 44.2, s: 41.2, w: 22.3, e: 28.6,
    polygons: [[[44.0, 23.0], [44.0, 28.5], [42.0, 28.0], [41.2, 23.0], [44.0, 23.0]]]
  },
  {
    code: "UA", name: "Ukraine",
    n: 52.4, s: 44.4, w: 22.1, e: 40.2,
    polygons: [[[52.0, 24.0], [52.0, 40.0], [48.0, 40.0], [45.0, 35.0], [45.0, 30.0], [48.0, 22.0], [52.0, 24.0]]]
  },
  {
    code: "BY", name: "Belarus",
    n: 56.2, s: 51.2, w: 23.1, e: 32.8,
    polygons: [[[56.0, 26.0], [56.0, 32.0], [52.0, 32.0], [51.5, 24.0], [56.0, 26.0]]]
  },
  {
    code: "MD", name: "Moldova",
    n: 48.5, s: 45.4, w: 26.6, e: 30.1,
    polygons: [[[48.5, 27.5], [48.0, 30.0], [45.5, 30.0], [46.0, 28.0], [48.5, 27.5]]]
  },
  {
    code: "GR", name: "Greece",
    n: 41.8, s: 34.8, w: 19.3, e: 28.3,
    polygons: [
      [[41.5, 21.0], [41.0, 26.5], [37.5, 24.0], [36.5, 22.0], [40.0, 19.5], [41.5, 21.0]],
      [[35.5, 23.5], [35.5, 26.0], [35.0, 26.0], [35.0, 23.5], [35.5, 23.5]]
    ]
  },
  {
    code: "NO", name: "Norway",
    n: 71.2, s: 57.9, w: 4.6, e: 31.1,
    polygons: [[[71.0, 26.0], [70.0, 31.0], [60.0, 12.0], [58.0, 8.0], [62.0, 4.5], [71.0, 26.0]]]
  },
  {
    code: "SE", name: "Sweden",
    n: 69.1, s: 55.3, w: 10.9, e: 24.2,
    polygons: [[[69.0, 20.0], [66.0, 24.0], [59.0, 19.0], [55.5, 14.0], [56.0, 12.0], [63.0, 12.0], [69.0, 20.0]]]
  },
  {
    code: "FI", name: "Finland",
    n: 70.1, s: 59.7, w: 20.5, e: 31.6,
    polygons: [[[70.0, 28.0], [65.0, 30.0], [60.0, 27.0], [60.0, 21.0], [65.0, 24.0], [70.0, 28.0]]]
  },
  {
    code: "DK", name: "Denmark",
    n: 57.8, s: 54.5, w: 8.0, e: 15.2,
    polygons: [
      [[57.5, 8.5], [57.5, 10.5], [55.0, 10.5], [55.0, 8.5], [57.5, 8.5]],
      [[56.0, 11.0], [56.0, 12.5], [54.5, 12.5], [55.0, 11.5], [56.0, 11.0]]
    ]
  },
  {
    code: "IS", name: "Iceland",
    n: 66.6, s: 63.3, w: -24.5, e: -13.5,
    polygons: [[[66.5, -23.0], [66.5, -14.0], [63.5, -14.0], [63.5, -24.0], [66.5, -23.0]]]
  },
  {
    code: "AL", name: "Albania",
    n: 42.7, s: 39.6, w: 19.1, e: 21.1,
    polygons: [[[42.5, 20.0], [41.0, 21.0], [39.7, 20.0], [40.0, 19.2], [42.5, 20.0]]]
  },
  {
    code: "MK", name: "North Macedonia",
    n: 42.4, s: 40.8, w: 20.4, e: 23.0,
    polygons: [[[42.3, 21.5], [42.0, 23.0], [41.0, 22.5], [41.0, 20.5], [42.3, 21.5]]]
  },
  {
    code: "RS", name: "Serbia",
    n: 46.2, s: 41.8, w: 18.8, e: 23.0,
    polygons: [[[46.0, 20.0], [45.0, 23.0], [42.3, 22.0], [43.0, 19.0], [46.0, 20.0]]]
  },
  {
    code: "HR", name: "Croatia",
    n: 46.6, s: 42.3, w: 13.4, e: 19.5,
    polygons: [[[46.5, 16.0], [46.0, 19.0], [45.0, 19.0], [43.0, 16.0], [45.0, 13.5], [46.5, 16.0]]]
  },
  {
    code: "SI", name: "Slovenia",
    n: 47.0, s: 45.4, w: 13.3, e: 16.6,
    polygons: [[[47.0, 15.0], [46.5, 16.5], [45.5, 15.0], [45.5, 13.5], [47.0, 15.0]]]
  },
  {
    code: "BA", name: "Bosnia & Herzegovina",
    n: 45.3, s: 42.5, w: 15.7, e: 19.6,
    polygons: [[[45.0, 16.0], [45.0, 19.0], [43.0, 19.0], [42.6, 17.5], [44.0, 16.0], [45.0, 16.0]]]
  },
  {
    code: "ME", name: "Montenegro",
    n: 43.6, s: 41.8, w: 18.4, e: 20.4,
    polygons: [[[43.5, 19.0], [43.0, 20.0], [42.0, 19.5], [42.0, 18.5], [43.5, 19.0]]]
  },
  {
    code: "XK", name: "Kosovo",
    n: 43.3, s: 41.8, w: 20.0, e: 21.8,
    polygons: [[[43.2, 21.0], [42.5, 21.7], [42.0, 21.0], [42.5, 20.1], [43.2, 21.0]]]
  },
  {
    code: "EE", name: "Estonia",
    n: 59.8, s: 57.5, w: 21.8, e: 28.3,
    polygons: [[[59.5, 24.0], [59.5, 28.0], [57.5, 27.5], [58.0, 24.0], [59.5, 24.0]]]
  },
  {
    code: "LV", name: "Latvia",
    n: 58.1, s: 55.7, w: 20.9, e: 28.3,
    polygons: [[[58.0, 22.0], [58.0, 28.0], [56.0, 28.0], [56.0, 21.0], [58.0, 22.0]]]
  },
  {
    code: "LT", name: "Lithuania",
    n: 56.5, s: 53.9, w: 20.9, e: 26.9,
    polygons: [[[56.3, 22.0], [56.3, 26.5], [54.0, 26.5], [54.0, 21.0], [56.3, 22.0]]]
  },
  {
    code: "MT", name: "Malta",
    n: 36.1, s: 35.8, w: 14.1, e: 14.6,
    polygons: [[[36.0, 14.2], [36.0, 14.5], [35.8, 14.5], [35.8, 14.3], [36.0, 14.2]]]
  },
  {
    code: "AD", name: "Andorra",
    n: 42.6, s: 42.4, w: 1.4, e: 1.7,
    polygons: [[[42.6, 1.5], [42.6, 1.7], [42.4, 1.7], [42.4, 1.4], [42.6, 1.5]]]
  },
  {
    code: "LI", name: "Liechtenstein",
    n: 47.3, s: 47.0, w: 9.4, e: 9.6,
    polygons: [[[47.3, 9.5], [47.3, 9.6], [47.0, 9.6], [47.0, 9.4], [47.3, 9.5]]]
  },
  {
    code: "MC", name: "Monaco",
    n: 43.75, s: 43.72, w: 7.41, e: 7.43,
    polygons: [[[43.75, 7.42], [43.74, 7.43], [43.72, 7.42], [43.73, 7.41], [43.75, 7.42]]]
  },
  {
    code: "SM", name: "San Marino",
    n: 43.95, s: 43.89, w: 12.4, e: 12.5,
    polygons: [[[43.95, 12.45], [43.94, 12.5], [43.9, 12.45], [43.91, 12.4], [43.95, 12.45]]]
  },
  {
    code: "VA", name: "Vatican City",
    n: 41.907, s: 41.900, w: 12.447, e: 12.458,
    polygons: [[[41.907, 12.452], [41.905, 12.458], [41.900, 12.453], [41.902, 12.447], [41.907, 12.452]]]
  },

  // Higher Precision Territories
  {
    code: "GI", name: "Gibraltar",
    n: 36.16, s: 36.10, w: -5.37, e: -5.33,
    polygons: [[[36.16, -5.35], [36.15, -5.33], [36.10, -5.34], [36.11, -5.37], [36.16, -5.35]]]
  },
  {
    code: "GG", name: "Guernsey",
    n: 49.5, s: 49.4, w: -2.7, e: -2.5,
    polygons: [[[49.5, -2.6], [49.5, -2.5], [49.4, -2.5], [49.4, -2.7], [49.5, -2.6]]]
  },
  {
    code: "JE", name: "Jersey",
    n: 49.3, s: 49.1, w: -2.2, e: -2.0,
    polygons: [[[49.3, -2.1], [49.3, -2.0], [49.1, -2.0], [49.1, -2.2], [49.3, -2.1]]]
  },
  {
    code: "IM", name: "Isle of Man",
    n: 54.4, s: 54.0, w: -4.8, e: -4.3,
    polygons: [[[54.4, -4.5], [54.3, -4.3], [54.0, -4.5], [54.1, -4.8], [54.4, -4.5]]]
  },
  {
    code: "FO", name: "Faroe Islands",
    n: 62.4, s: 61.4, w: -7.7, e: -6.3,
    polygons: [[[62.4, -7.0], [62.3, -6.3], [61.4, -6.7], [61.5, -7.7], [62.4, -7.0]]]
  },
  {
    code: "AX", name: "Åland Islands",
    n: 60.5, s: 59.8, w: 19.3, e: 21.1,
    polygons: [[[60.5, 20.0], [60.3, 21.0], [59.9, 21.0], [59.8, 19.5], [60.5, 20.0]]]
  },
  {
    code: "XU", name: "Akrotiri",
    n: 34.7, s: 34.5, w: 32.8, e: 33.1,
    polygons: [[[34.7, 32.9], [34.7, 33.1], [34.5, 33.1], [34.5, 32.8], [34.7, 32.9]]]
  },
  {
    code: "XD", name: "Dhekelia",
    n: 35.1, s: 34.9, w: 33.7, e: 33.9,
    polygons: [[[35.1, 33.8], [35.1, 33.9], [34.9, 33.9], [34.9, 33.7], [35.1, 33.8]]]
  },
  {
    code: "EA", name: "Ceuta",
    n: 35.91, s: 35.87, w: -5.34, e: -5.28,
    polygons: [[[35.91, -5.32], [35.90, -5.28], [35.87, -5.30], [35.88, -5.34], [35.91, -5.32]]]
  },
  {
    code: "EA", name: "Melilla",
    n: 35.31, s: 35.27, w: -2.96, e: -2.92,
    polygons: [[[35.31, -2.94], [35.30, -2.92], [35.27, -2.93], [35.28, -2.96], [35.31, -2.94]]]
  },
  {
    code: "PT", name: "Azores",
    n: 40.0, s: 36.0, w: -32.0, e: -24.0,
    polygons: [[[40.0, -28.0], [39.0, -24.0], [36.0, -26.0], [37.0, -32.0], [40.0, -28.0]]]
  },
  {
    code: "PT", name: "Madeira",
    n: 33.2, s: 32.3, w: -17.3, e: -16.2,
    polygons: [[[33.1, -17.0], [33.0, -16.2], [32.4, -16.5], [32.5, -17.3], [33.1, -17.0]]]
  },
  {
    code: "SJ", name: "Svalbard",
    n: 81.0, s: 74.0, w: 10.0, e: 35.0,
    polygons: [[[80.0, 15.0], [80.0, 30.0], [76.0, 25.0], [76.0, 10.0], [80.0, 15.0]]]
  },
  {
    code: "SJ", name: "Jan Mayen",
    n: 71.2, s: 70.8, w: -9.1, e: -7.9,
    polygons: [[[71.2, -8.5], [71.1, -8.0], [70.8, -8.5], [70.9, -9.0], [71.2, -8.5]]]
  },

  // Oceania & Territories
  { code: "GU", n: 13.7, s: 13.2, w: 144.6, e: 145.0, name: "Guam" },
  { code: "MP", n: 20.6, s: 14.1, w: 144.8, e: 146.1, name: "Northern Mariana Islands" },
  { code: "AS", n: -14.1, s: -14.4, w: -170.9, e: -170.4, name: "American Samoa" },
  { code: "PF", n: -7.0, s: -28.0, w: -155.0, e: -134.0, name: "French Polynesia" },
  { code: "NC", n: -19.0, s: -23.0, w: 163.0, e: 168.0, name: "New Caledonia" },
  { code: "PG", n: 0.0, s: -12.0, w: 141.0, e: 156.0, name: "Papua New Guinea" },
  { code: "NZ", n: -34.3, s: -47.3, w: 166.4, e: 178.6, name: "New Zealand", polygon: [[-35.0, 174.0], [-40.0, 175.0], [-45.0, 170.0], [-47.0, 168.0], [-45.0, 167.0], [-40.0, 172.0], [-35.0, 173.0], [-35.0, 174.0]] },
  { code: "FJ", n: -12.0, s: -21.0, w: 177.0, e: -178.0, name: "Fiji" },
  { code: "VU", n: -13.0, s: -21.0, w: 166.0, e: 171.0, name: "Vanuatu" },
  { code: "SB", n: -5.0, s: -13.0, w: 155.0, e: 171.0, name: "Solomon Islands" },
  { code: "PW", n: 8.5, s: 2.5, w: 134.0, e: 135.0, name: "Palau" },
  { code: "FM", n: 10.5, s: 0.5, w: 137.0, e: 164.0, name: "Micronesia" },
  { code: "MH", n: 15.0, s: 4.0, w: 160.0, e: 173.0, name: "Marshall Islands" },
  { code: "KI", n: 5.0, s: -12.0, w: 169.0, e: -150.0, name: "Kiribati" },
  { code: "TO", n: -15.0, s: -24.0, w: -176.0, e: -173.0, name: "Tonga" },
  { code: "WS", n: -13.0, s: -15.0, w: -173.0, e: -171.0, name: "Samoa" },
  { code: "TV", n: -5.0, s: -11.0, w: 176.0, e: 180.0, name: "Tuvalu" },
  { code: "NR", n: -0.5, s: -0.6, w: 166.9, e: 167.0, name: "Nauru" },
  { code: "CK", n: -8.0, s: -23.0, w: -166.0, e: -157.0, name: "Cook Islands" },
  { code: "NU", n: -19.0, s: -19.1, w: -169.9, e: -169.8, name: "Niue" },
  { code: "TK", n: -8.0, s: -10.0, w: -173.0, e: -171.0, name: "Tokelau" },
  { code: "WF", n: -13.0, s: -14.5, w: -178.5, e: -176.0, name: "Wallis and Futuna" },
  { code: "PN", n: -24.0, s: -25.5, w: -131.0, e: -128.0, name: "Pitcairn Islands" },
  { code: "NF", n: -29.0, s: -29.1, w: 167.9, e: 168.0, name: "Norfolk Island" },
  { code: "CX", n: -10.4, s: -10.6, w: 105.6, e: 105.8, name: "Christmas Island" },
  { code: "CC", n: -12.0, s: -12.2, w: 96.7, e: 96.9, name: "Cocos Islands" },
  { code: "CL", n: -27.0, s: -27.2, w: -109.5, e: -109.3, name: "Easter Island" },
  { code: "EC", n: 1.7, s: -1.5, w: -92.0, e: -89.0, name: "Galapagos Islands" },
  { code: "UM", n: 28.3, s: 28.1, w: -177.4, e: -177.2, name: "Midway Atoll" },
  { code: "UM", n: 19.4, s: 19.2, w: 166.5, e: 166.7, name: "Wake Island" },
  { code: "UM", n: 16.8, s: 16.6, w: -169.6, e: -169.4, name: "Johnston Atoll" },

  // South America
  {
    code: "BR", name: "Brazil",
    n: 5.3, s: -33.8, w: -74.0, e: -34.7,
    polygons: [
      [[5.3, -60.0], [4.5, -51.5], [2.1, -52.5], [0.0, -45.0], [-10.0, -35.0], [-20.0, -40.0], [-23.0, -42.0], [-33.7, -53.5], [-30.0, -57.0], [-20.0, -58.0], [-10.0, -70.0], [0.0, -70.0], [4.0, -74.0], [5.3, -60.0]]
    ]
  },
  {
    code: "AR", name: "Argentina",
    n: -21.7, s: -55.1, w: -73.6, e: -53.6,
    polygons: [
      [[-22.0, -65.0], [-22.0, -58.0], [-28.0, -54.0], [-34.0, -58.0], [-40.0, -62.0], [-54.5, -67.0], [-55.0, -71.5], [-40.0, -72.0], [-30.0, -70.5], [-22.0, -65.0]]
    ]
  },
  {
    code: "CL", name: "Chile",
    n: -17.5, s: -56.0, w: -75.7, e: -66.4,
    polygons: [
      [[-17.6, -70.0], [-25.0, -70.0], [-35.0, -73.0], [-45.0, -75.0], [-55.5, -69.0], [-55.5, -67.0], [-45.0, -71.5], [-35.0, -70.0], [-25.0, -68.5], [-17.6, -70.0]]
    ]
  },
  {
    code: "CO", name: "Colombia",
    n: 13.5, s: -4.3, w: -79.1, e: -66.8,
    polygons: [
      [[12.5, -72.0], [11.0, -68.0], [5.0, -67.0], [0.0, -70.0], [-4.2, -70.0], [-0.0, -79.0], [8.0, -77.5], [12.5, -72.0]]
    ]
  },
  {
    code: "PE", name: "Peru",
    n: 0.1, s: -18.4, w: -81.4, e: -68.6,
    polygons: [
      [[0.0, -75.0], [-4.0, -70.0], [-11.0, -69.0], [-18.3, -69.0], [-18.3, -71.0], [-14.0, -76.0], [-5.0, -81.3], [0.0, -75.0]]
    ]
  },
  {
    code: "VE", name: "Venezuela",
    n: 12.2, s: 0.6, w: -73.4, e: -59.8,
    polygons: [
      [[12.2, -71.5], [10.5, -62.0], [8.5, -59.8], [1.0, -66.0], [5.0, -73.3], [12.2, -71.5]]
    ]
  },
  {
    code: "BO", name: "Bolivia",
    n: -9.7, s: -22.9, w: -69.6, e: -57.5,
    polygons: [
      [[-9.7, -65.5], [-15.0, -57.5], [-22.9, -62.5], [-22.9, -69.6], [-15.0, -69.6], [-9.7, -65.5]]
    ]
  },
  {
    code: "PY", name: "Paraguay",
    n: -19.3, s: -27.6, w: -62.6, e: -54.3,
    polygons: [
      [[-19.3, -58.5], [-24.0, -54.3], [-27.6, -56.0], [-27.6, -62.6], [-19.3, -62.6], [-19.3, -58.5]]
    ]
  },
  {
    code: "UY", name: "Uruguay",
    n: -30.1, s: -35.0, w: -58.4, e: -53.2,
    polygons: [
      [[-30.1, -57.5], [-33.5, -53.2], [-35.0, -54.9], [-34.0, -58.4], [-30.1, -57.5]]
    ]
  },
  {
    code: "EC", name: "Ecuador",
    n: 1.5, s: -5.0, w: -81.0, e: -75.2,
    polygons: [
      [[1.5, -79.0], [-2.0, -75.3], [-5.0, -79.0], [-3.0, -81.0], [1.5, -79.0]]
    ]
  },
  {
    code: "GY", name: "Guyana",
    n: 8.5, s: 1.2, w: -61.4, e: -56.5,
    polygons: [[[8.5, -59.8], [7.0, -57.0], [1.2, -58.5], [5.0, -61.4], [8.5, -59.8]]]
  },
  {
    code: "SR", name: "Suriname",
    n: 6.0, s: 1.8, w: -58.1, e: -54.0,
    polygons: [[[6.0, -57.0], [5.8, -54.0], [2.0, -54.0], [1.8, -58.1], [6.0, -57.0]]]
  },
  {
    code: "GF", name: "French Guiana",
    n: 5.8, s: 2.1, w: -54.6, e: -51.6,
    polygons: [[[5.8, -54.0], [4.5, -51.6], [2.1, -52.5], [5.8, -54.0]]]
  },
  { code: "FK", n: -51.0, s: -53.0, w: -61.5, e: -57.5, name: "Falkland Islands" },
  { code: "GS", n: -54.0, s: -55.0, w: -38.5, e: -26.0, name: "South Georgia & South Sandwich" },

  // Africa - High Precision Refinement (Nested/Smaller first)
  {
    code: "GM", name: "Gambia",
    n: 13.8, s: 13.1, w: -16.9, e: -13.8,
    polygons: [[[13.8, -16.7], [13.7, -13.8], [13.3, -13.9], [13.1, -16.8], [13.8, -16.7]]]
  },
  {
    code: "LS", name: "Lesotho",
    n: -28.5, s: -30.7, w: 27.0, e: 29.5,
    polygons: [[[-28.5, 28.5], [-29.5, 29.4], [-30.7, 28.5], [-30.0, 27.0], [-28.5, 28.5]]]
  },
  {
    code: "SZ", name: "Eswatini",
    n: -25.7, s: -27.3, w: 30.7, e: 32.2,
    polygons: [[[-25.7, 31.5], [-26.5, 32.2], [-27.3, 31.5], [-26.5, 30.7], [-25.7, 31.5]]]
  },
  {
    code: "RW", name: "Rwanda",
    n: -1.0, s: -2.9, w: 28.8, e: 30.9,
    polygons: [[[-1.0, 30.0], [-2.0, 30.8], [-2.9, 30.0], [-2.5, 29.0], [-1.0, 30.0]]]
  },
  {
    code: "BI", name: "Burundi",
    n: -2.3, s: -4.5, w: 28.9, e: 30.9,
    polygons: [[[-2.4, 30.0], [-3.0, 30.8], [-4.5, 30.0], [-3.5, 29.0], [-2.4, 30.0]]]
  },
  {
    code: "DJ", name: "Djibouti",
    n: 12.7, s: 10.9, w: 41.7, e: 43.5,
    polygons: [[[12.7, 42.5], [12.0, 43.5], [11.0, 43.0], [11.0, 42.0], [12.7, 42.5]]]
  },
  {
    code: "GQ", name: "Equatorial Guinea",
    n: 3.8, s: 1.0, w: 8.4, e: 11.4,
    polygons: [
      [[2.3, 9.5], [2.3, 11.3], [1.0, 11.3], [1.0, 9.5], [2.3, 9.5]],
      [[3.8, 8.5], [3.8, 9.0], [3.3, 9.0], [3.3, 8.5], [3.8, 8.5]]
    ]
  },
  {
    code: "ST", name: "Sao Tome and Principe",
    n: 1.8, s: -0.1, w: 6.4, e: 7.5,
    polygons: [
      [[0.4, 6.6], [0.4, 6.8], [0.1, 6.7], [0.1, 6.5], [0.4, 6.6]],
      [[1.7, 7.3], [1.7, 7.5], [1.5, 7.5], [1.5, 7.3], [1.7, 7.3]]
    ]
  },
  {
    code: "KM", name: "Comoros",
    n: -11.3, s: -12.5, w: 43.2, e: 44.6,
    polygons: [
      [[-11.4, 43.3], [-11.4, 43.5], [-11.7, 43.5], [-11.7, 43.3], [-11.4, 43.3]],
      [[-12.2, 44.3], [-12.2, 44.5], [-12.5, 44.5], [-12.5, 44.3], [-12.2, 44.3]]
    ]
  },
  {
    code: "MU", name: "Mauritius",
    n: -19.9, s: -20.6, w: 57.3, e: 57.8,
    polygons: [[[-19.9, 57.5], [-20.0, 57.8], [-20.5, 57.6], [-20.5, 57.3], [-19.9, 57.5]]]
  },
  {
    code: "SC", name: "Seychelles",
    n: -3.6, s: -10.3, w: 46.1, e: 56.4,
    polygons: [[[-4.5, 55.4], [-4.7, 55.6], [-4.9, 55.4], [-4.7, 55.2], [-4.5, 55.4]]]
  },
  {
    code: "CV", name: "Cabo Verde",
    n: 17.3, s: 14.7, w: -25.4, e: -22.6,
    polygons: [
      [[17.0, -25.0], [17.2, -24.8], [16.8, -24.8], [16.8, -25.0], [17.0, -25.0]],
      [[15.0, -23.5], [15.2, -23.3], [14.8, -23.3], [14.8, -23.5], [15.0, -23.5]]
    ]
  },
  {
    code: "RE", name: "Reunion",
    n: -20.8, s: -21.4, w: 55.2, e: 55.9,
    polygons: [[[-20.8, 55.5], [-21.0, 55.9], [-21.4, 55.6], [-21.2, 55.2], [-20.8, 55.5]]]
  },
  {
    code: "YT", name: "Mayotte",
    n: -12.6, s: -13.0, w: 45.0, e: 45.3,
    polygons: [[[-12.6, 45.1], [-12.7, 45.3], [-13.0, 45.2], [-12.9, 45.0], [-12.6, 45.1]]]
  },
  {
    code: "SH", name: "Saint Helena",
    n: -15.9, s: -16.0, w: -5.7, e: -5.6,
    polygons: [[[-15.9, -5.7], [-15.9, -5.6], [-16.0, -5.6], [-16.0, -5.7], [-15.9, -5.7]]]
  },
  {
    code: "AC", name: "Ascension",
    n: -7.8, s: -8.0, w: -14.5, e: -14.2,
    polygons: [[[-7.8, -14.4], [-7.8, -14.3], [-8.0, -14.3], [-8.0, -14.4], [-7.8, -14.4]]]
  },
  {
    code: "TA", name: "Tristan da Cunha",
    n: -37.0, s: -37.2, w: -12.4, e: -12.2,
    polygons: [[[-37.0, -12.4], [-37.0, -12.2], [-37.2, -12.2], [-37.2, -12.4], [-37.0, -12.4]]]
  },
  {
    code: "BV", name: "Bouvet Island",
    n: -54.3, s: -54.5, w: 3.3, e: 3.5,
    polygons: [[[-54.3, 3.4], [-54.3, 3.5], [-54.5, 3.5], [-54.5, 3.3], [-54.3, 3.4]]]
  },
  {
    code: "IC", name: "Canary Islands",
    n: 29.5, s: 27.5, w: -18.2, e: -13.4,
    polygons: [
      [[28.6, -17.8], [28.8, -17.7], [28.6, -17.6], [28.5, -17.7], [28.6, -17.8]],
      [[28.0, -15.6], [28.2, -15.3], [27.8, -15.3], [27.7, -15.6], [28.0, -15.6]]
    ]
  },
  
  {
    code: "ZA", name: "South Africa",
    n: -22.1, s: -34.9, w: 16.4, e: 32.9,
    polygons: [[[-22.0, 30.0], [-27.0, 33.0], [-34.0, 25.0], [-34.0, 18.0], [-28.0, 16.0], [-22.0, 20.0], [-22.0, 30.0]]]
  },
  {
    code: "EG", name: "Egypt",
    n: 31.7, s: 21.9, w: 24.6, e: 36.9,
    polygons: [[[31.0, 25.0], [31.0, 34.0], [22.0, 36.0], [22.0, 25.0], [31.0, 25.0]]]
  },
  {
    code: "NG", name: "Nigeria",
    n: 13.9, s: 4.2, w: 2.6, e: 14.7,
    polygons: [[[13.0, 4.0], [13.0, 14.0], [4.0, 9.0], [4.0, 4.0], [13.0, 4.0]]]
  },
  {
    code: "KE", name: "Kenya",
    n: 5.5, s: -4.7, w: 33.9, e: 41.9,
    polygons: [[[5.0, 35.0], [4.0, 41.0], [-4.0, 40.0], [-2.0, 34.0], [5.0, 35.0]]]
  },
  {
    code: "MA", name: "Morocco",
    n: 35.9, s: 21.3, w: -17.2, e: -1.0,
    polygons: [[[35.0, -2.0], [30.0, -10.0], [21.0, -17.0], [28.0, -12.0], [35.0, -6.0], [35.0, -2.0]]]
  },
  {
    code: "DZ", name: "Algeria",
    n: 37.1, s: 18.9, w: -8.7, e: 12.0,
    polygons: [[[37.0, 0.0], [37.0, 8.0], [20.0, 12.0], [19.0, 0.0], [25.0, -8.0], [37.0, 0.0]]]
  },
  {
    code: "ET", name: "Ethiopia",
    n: 14.9, s: 3.3, w: 32.9, e: 48.0,
    polygons: [[[14.0, 38.0], [12.0, 48.0], [4.0, 45.0], [4.0, 34.0], [14.0, 38.0]]]
  },
  {
    code: "TZ", name: "Tanzania",
    n: -0.9, s: -11.8, w: 29.3, e: 40.5,
    polygons: [[[-1.0, 32.0], [-4.0, 40.0], [-11.0, 40.0], [-10.0, 30.0], [-1.0, 32.0]]]
  },
  {
    code: "LY", name: "Libya",
    n: 33.0, s: 19.5, w: 9.4, e: 25.1,
    polygons: [[[33.0, 10.0], [33.0, 25.0], [20.0, 25.0], [20.0, 10.0], [33.0, 10.0]]]
  },
  {
    code: "SD", name: "Sudan",
    n: 22.2, s: 9.3, w: 21.8, e: 38.6,
    polygons: [[[22.0, 25.0], [22.0, 36.0], [10.0, 34.0], [10.0, 22.0], [22.0, 25.0]]]
  },
  {
    code: "CD", name: "DR Congo",
    n: 5.4, s: -13.5, w: 12.2, e: 31.3,
    polygons: [[[5.0, 15.0], [4.0, 25.0], [-10.0, 30.0], [-13.0, 25.0], [-10.0, 15.0], [-5.0, 12.0], [5.0, 15.0]]]
  },
  {
    code: "AO", name: "Angola",
    n: -4.4, s: -18.1, w: 11.6, e: 24.1,
    polygons: [[[-6.0, 12.0], [-6.0, 20.0], [-18.0, 22.0], [-18.0, 12.0], [-6.0, 12.0]]]
  },
  {
    code: "ML", name: "Mali",
    n: 25.0, s: 10.1, w: -12.2, e: 4.3,
    polygons: [[[25.0, -5.0], [20.0, 4.0], [12.0, 0.0], [10.0, -10.0], [25.0, -5.0]]]
  },
  {
    code: "NE", name: "Niger",
    n: 23.5, s: 11.7, w: 0.1, e: 16.0,
    polygons: [[[23.0, 5.0], [23.0, 15.0], [13.0, 15.0], [12.0, 5.0], [23.0, 5.0]]]
  },
  {
    code: "TD", name: "Chad",
    n: 23.5, s: 7.4, w: 13.4, e: 24.1,
    polygons: [[[23.0, 15.0], [23.0, 24.0], [10.0, 22.0], [8.0, 15.0], [23.0, 15.0]]]
  },
  {
    code: "MR", name: "Mauritania",
    n: 27.3, s: 14.7, w: -17.1, e: -4.8,
    polygons: [[[27.0, -10.0], [25.0, -5.0], [15.0, -10.0], [15.0, -17.0], [27.0, -10.0]]]
  },
  {
    code: "TN", name: "Tunisia",
    n: 37.6, s: 30.2, w: 7.5, e: 11.6,
    polygons: [[[37.0, 10.0], [37.0, 11.0], [33.0, 11.0], [30.0, 10.0], [33.0, 8.0], [37.0, 10.0]]]
  },
  {
    code: "GH", name: "Ghana",
    n: 11.2, s: 4.7, w: -3.3, e: 1.2,
    polygons: [[[11.0, -1.0], [11.0, 1.0], [5.0, 1.0], [5.0, -3.0], [11.0, -1.0]]]
  },
  {
    code: "CI", name: "Ivory Coast",
    n: 10.8, s: 4.3, w: -8.6, e: -2.4,
    polygons: [[[10.0, -5.0], [10.0, -3.0], [5.0, -3.0], [5.0, -8.0], [10.0, -5.0]]]
  },
  {
    code: "CM", name: "Cameroon",
    n: 13.1, s: 1.6, w: 8.4, e: 16.2,
    polygons: [[[12.0, 14.0], [10.0, 16.0], [2.0, 15.0], [4.0, 9.0], [12.0, 14.0]]]
  },
  {
    code: "SN", name: "Senegal",
    n: 16.7, s: 12.3, w: -17.6, e: -11.3,
    polygons: [[[16.0, -16.0], [16.0, -12.0], [13.0, -12.0], [13.0, -17.0], [16.0, -16.0]]]
  },
  {
    code: "MG", name: "Madagascar",
    n: -11.9, s: -25.7, w: 43.1, e: 50.5,
    polygons: [[[-12.0, 49.0], [-16.0, 50.0], [-25.0, 47.0], [-25.0, 44.0], [-15.0, 46.0], [-12.0, 49.0]]]
  },
  {
    code: "ZW", name: "Zimbabwe",
    n: -15.6, s: -22.5, w: 25.2, e: 33.1,
    polygons: [[[-15.6, 28.5], [-17.0, 33.0], [-22.5, 31.0], [-22.2, 25.2], [-15.6, 28.5]]]
  },
  {
    code: "ZM", name: "Zambia",
    n: -8.2, s: -18.1, w: 21.9, e: 33.7,
    polygons: [[[-8.2, 30.0], [-13.0, 33.7], [-18.1, 26.0], [-15.0, 22.0], [-8.2, 30.0]]]
  },
  {
    code: "BW", name: "Botswana",
    n: -17.7, s: -26.9, w: 19.9, e: 29.4,
    polygons: [[[-17.7, 25.0], [-20.0, 29.4], [-26.9, 25.0], [-22.0, 20.0], [-17.7, 25.0]]]
  },
  {
    code: "NA", name: "Namibia",
    n: -16.9, s: -29.0, w: 11.7, e: 25.3,
    polygons: [[[-16.9, 20.0], [-18.0, 25.3], [-29.0, 20.0], [-28.0, 11.7], [-16.9, 20.0]]]
  },
  {
    code: "MZ", name: "Mozambique",
    n: -10.4, s: -26.9, w: 30.2, e: 40.9,
    polygons: [[[-10.4, 40.0], [-15.0, 40.9], [-26.9, 33.0], [-20.0, 33.0], [-10.4, 40.0]]]
  },
  {
    code: "UG", name: "Uganda",
    n: 4.3, s: -1.5, w: 29.5, e: 35.1,
    polygons: [[[4.0, 32.0], [2.0, 35.1], [-1.5, 32.0], [0.0, 29.5], [4.0, 32.0]]]
  },
  {
    code: "BJ", name: "Benin",
    n: 12.4, s: 6.2, w: 0.7, e: 3.9,
    polygons: [[[12.4, 2.0], [10.0, 3.9], [6.2, 2.5], [7.0, 0.7], [12.4, 2.0]]]
  },
  {
    code: "BF", name: "Burkina Faso",
    n: 15.1, s: 9.4, w: -5.5, e: 2.4,
    polygons: [[[15.1, -1.0], [14.0, 2.4], [9.4, 1.0], [10.0, -5.5], [15.1, -1.0]]]
  },
  {
    code: "CF", name: "Central African Republic",
    n: 11.0, s: 2.2, w: 14.4, e: 27.5,
    polygons: [[[11.0, 20.0], [7.0, 27.5], [2.2, 20.0], [4.0, 14.4], [11.0, 20.0]]]
  },
  {
    code: "CG", name: "Congo",
    n: 3.7, s: -5.1, w: 11.1, e: 18.7,
    polygons: [[[3.7, 16.0], [0.0, 18.7], [-5.1, 12.0], [-4.0, 11.1], [3.7, 16.0]]]
  },
  {
    code: "ER", name: "Eritrea",
    n: 18.1, s: 12.3, w: 36.4, e: 43.2,
    polygons: [[[18.1, 38.0], [15.0, 43.2], [12.3, 42.0], [14.0, 36.4], [18.1, 38.0]]]
  },
  {
    code: "GA", name: "Gabon",
    n: 2.4, s: -3.9, w: 8.4, e: 14.5,
    polygons: [[[2.4, 11.0], [1.0, 14.5], [-3.9, 11.0], [-1.0, 8.4], [2.4, 11.0]]]
  },
  {
    code: "GN", name: "Guinea",
    n: 12.7, s: 7.2, w: -15.1, e: -7.6,
    polygons: [[[12.7, -12.0], [10.0, -7.6], [7.2, -10.0], [9.0, -15.1], [12.7, -12.0]]]
  },
  {
    code: "GW", name: "Guinea-Bissau",
    n: 12.7, s: 10.9, w: -16.8, e: -13.6,
    polygons: [[[12.7, -15.0], [12.5, -13.6], [10.9, -14.5], [11.0, -16.8], [12.7, -15.0]]]
  },
  {
    code: "LR", name: "Liberia",
    n: 8.6, s: 4.3, w: -11.5, e: -7.3,
    polygons: [[[8.6, -10.0], [7.5, -7.3], [4.3, -7.5], [6.5, -11.5], [8.6, -10.0]]]
  },
  {
    code: "MW", name: "Malawi",
    n: -9.3, s: -17.2, w: 32.6, e: 36.0,
    polygons: [[[-9.3, 34.0], [-14.0, 36.0], [-17.2, 35.0], [-14.0, 32.6], [-9.3, 34.0]]]
  },
  {
    code: "SL", name: "Sierra Leone",
    n: 10.0, s: 6.9, w: -13.3, e: -10.2,
    polygons: [[[10.0, -11.5], [9.0, -10.2], [6.9, -11.5], [8.5, -13.3], [10.0, -11.5]]]
  },
  {
    code: "SO", name: "Somalia",
    n: 12.0, s: -1.7, w: 40.9, e: 51.5,
    polygons: [[[12.0, 45.0], [12.0, 51.5], [-1.7, 41.5], [2.0, 40.9], [12.0, 45.0]]]
  },
  {
    code: "SS", name: "South Sudan",
    n: 12.3, s: 3.4, w: 23.4, e: 36.0,
    polygons: [[[12.3, 30.0], [10.0, 36.0], [3.4, 32.0], [7.0, 23.4], [12.3, 30.0]]]
  },
  {
    code: "TG", name: "Togo",
    n: 11.2, s: 6.1, w: -0.2, e: 1.9,
    polygons: [[[11.2, 0.5], [11.0, 1.0], [6.1, 1.3], [6.2, 1.1], [11.2, 0.5]]]
  },
  {
    code: "EH", name: "Western Sahara (Disputed)",
    n: 27.7, s: 20.8, w: -17.1, e: -8.7,
    polygons: [[[27.7, -13.0], [27.7, -8.7], [20.8, -13.0], [21.0, -17.1], [27.7, -13.0]]]
  },
  {
    code: "TRNC", name: "Northern Cyprus (TRNC)",
    n: 35.7, s: 35.0, w: 32.2, e: 34.6,
    polygons: [[[35.1, 32.3], [35.2, 33.0], [35.4, 34.0], [35.7, 34.6], [35.4, 34.4], [35.2, 33.8], [35.1, 32.3]]]
  },
  {
    code: "SLND", name: "Somaliland",
    n: 12.0, s: 8.0, w: 42.5, e: 49.0,
    polygons: [[[11.5, 43.0], [11.0, 48.0], [10.0, 49.0], [8.0, 48.0], [8.5, 43.0], [11.5, 43.0]]]
  },
  {
    code: "PMR", name: "Transnistria (Disputed)",
    n: 48.2, s: 46.5, w: 28.3, e: 30.2,
    polygons: [[[48.2, 28.6], [48.1, 28.8], [47.5, 29.5], [46.6, 30.1], [46.6, 29.8], [47.5, 29.1], [48.2, 28.6]]]
  },
  {
    code: "PHIS", name: "Pheasant Island (Condominium)",
    n: 43.343, s: 43.341, w: -1.766, e: -1.764,
    polygons: [[[43.3425, -1.7658], [43.3425, -1.7648], [43.3415, -1.7648], [43.3415, -1.7658], [43.3425, -1.7658]]]
  },
  {
    code: "BAAR", name: "Baarle Enclaves (Complex Boundary)",
    n: 51.45, s: 51.43, w: 4.91, e: 4.95,
    polygons: [[[51.45, 4.91], [51.45, 4.95], [51.43, 4.95], [51.43, 4.91], [51.45, 4.91]]]
  },
  {
    code: "CYGL", name: "UN Buffer Zone (Cyprus)",
    n: 35.15, s: 35.05, w: 32.9, e: 33.9,
    polygons: [[[35.12, 33.0], [35.13, 33.5], [35.08, 33.8], [35.07, 33.5], [35.12, 33.0]]]
  },
  {
    code: "BT_T", name: "Bir Tawil (Terra Nullius)",
    n: 22.0, s: 21.8, w: 33.1, e: 34.2,
    polygons: [[[22.0, 33.7], [22.0, 34.2], [21.8, 33.7], [21.9, 33.1], [22.0, 33.7]]]
  },
  {
    code: "CRIM", name: "Crimea (Disputed)",
    n: 46.2, s: 44.3, w: 32.4, e: 36.7,
    polygons: [[[46.2, 33.3], [46.0, 35.0], [45.3, 36.7], [44.4, 34.1], [44.6, 33.0], [46.2, 33.3]]]
  },
  {
    code: "DONB", name: "Eastern Ukraine (Donbas - Disputed)",
    n: 49.3, s: 47.1, w: 36.6, e: 40.2,
    polygons: [[[49.3, 38.0], [49.3, 40.2], [47.1, 39.5], [47.5, 37.0], [49.3, 38.0]]]
  },
  {
    code: "KASH", name: "Kashmir (Disputed Region)",
    n: 37.1, s: 32.2, w: 72.5, e: 80.3,
    polygons: [[[37.1, 75.0], [35.5, 80.3], [32.5, 79.5], [32.2, 74.0], [35.0, 72.5], [37.1, 75.0]]]
  },
  {
    code: "SCSD", name: "South China Sea Islands (Disputed)",
    n: 20.0, s: 4.0, w: 108.0, e: 118.0,
    polygons: [
      [[11.0, 114.0], [11.5, 114.5], [11.0, 115.0], [10.5, 114.5], [11.0, 114.0]], // Spratly
      [[16.5, 112.0], [17.0, 112.5], [16.5, 113.0], [16.0, 112.5], [16.5, 112.0]]  // Paracel
    ]
  },
  {
    code: "EEBD", name: "Ethiopia-Eritrea Border (Disputed)",
    n: 14.9, s: 14.1, w: 37.5, e: 39.5,
    polygons: [[[14.9, 37.5], [14.9, 38.5], [14.1, 39.5], [14.1, 38.5], [14.9, 37.5]]]
  },

  // Antarctic & Indian Ocean Territories
  { code: "GS", n: -54.0, s: -59.5, w: -38.5, e: -26.0, name: "South Georgia" },
  { code: "IO", n: -5.0, s: -7.5, w: 71.0, e: 72.5, name: "BIOT (Chagos)" },
  { code: "TF", n: -37.0, s: -50.0, w: 37.0, e: 78.0, name: "French Southern Lands" },
  { code: "HM", n: -53.0, s: -53.2, w: 73.4, e: 73.8, name: "Heard & McDonald" },

  // Oceania - High Precision Refinement
  {
    code: "AU", name: "Australia",
    n: -10.0, s: -55.0, w: 112.9, e: 159.0,
    polygons: [
      [[-11.0, 142.0], [-12.0, 137.0], [-11.0, 132.0], [-15.0, 125.0], [-20.0, 115.0], [-25.0, 113.0], [-35.0, 115.0], [-35.0, 125.0], [-32.0, 135.0], [-38.5, 145.0], [-38.0, 150.0], [-28.0, 153.5], [-15.0, 145.0], [-11.0, 142.0]], // Mainland
      [[-40.5, 145.0], [-43.5, 147.0], [-43.5, 148.5], [-41.0, 148.5], [-40.5, 145.0]], // Tasmania
      [[-31.4, 159.0], [-31.5, 159.1], [-31.6, 159.1], [-31.6, 159.0], [-31.4, 159.0]], // Lord Howe
      [[-54.4, 158.8], [-54.5, 158.9], [-54.7, 158.8], [-54.6, 158.7], [-54.4, 158.8]]  // Macquarie
    ]
  },
  {
    code: "NZ", name: "New Zealand",
    n: -29.0, s: -53.0, w: 165.0, e: -175.0,
    polygons: [
      [[-34.4, 172.7], [-36.5, 174.5], [-37.5, 178.5], [-41.4, 175.5], [-39.5, 173.8], [-34.4, 172.7]], // North Island
      [[-40.5, 172.8], [-41.5, 174.1], [-44.0, 171.0], [-46.7, 169.5], [-46.7, 166.5], [-41.5, 171.5], [-40.5, 172.8]], // South Island
      [[-46.7, 167.5], [-46.8, 168.3], [-47.3, 168.0], [-47.2, 167.5], [-46.7, 167.5]], // Stewart Island
      [[-43.7, -176.3], [-43.7, -176.7], [-44.2, -176.7], [-44.2, -176.3], [-43.7, -176.3]], // Chatham Islands
      [[-29.2, -177.9], [-29.2, -178.0], [-29.3, -178.0], [-29.3, -177.9], [-29.2, -177.9]]  // Kermadec (Raoul)
    ]
  },
  {
    code: "PG", name: "Papua New Guinea",
    n: 0.0, s: -12.0, w: 140.0, e: 160.0,
    polygons: [[[-1.0, 141.0], [-3.0, 148.0], [-6.0, 148.0], [-10.0, 151.0], [-11.0, 149.0], [-8.0, 144.0], [-3.0, 141.0], [-1.0, 141.0]]]
  },
  {
    code: "FJ", name: "Fiji",
    n: -15.0, s: -22.0, w: 177.0, e: -178.0,
    polygons: [
      [[-18.2, 177.5], [-17.5, 177.5], [-17.5, 178.8], [-18.2, 178.8], [-18.2, 177.5]], // Viti Levu
      [[-16.5, 178.5], [-16.0, 179.5], [-17.0, 180.0], [-17.0, 179.0], [-16.5, 178.5]]  // Vanua Levu
    ]
  },
  {
    code: "SB", name: "Solomon Islands",
    n: -5.0, s: -12.5, w: 155.0, e: 170.5,
    polygons: [
      [[-9.3, 159.6], [-9.3, 160.8], [-10.0, 160.8], [-10.0, 159.6], [-9.3, 159.6]], // Guadalcanal
      [[-8.3, 160.6], [-8.3, 161.4], [-9.7, 161.4], [-9.7, 160.6], [-8.3, 160.6]], // Malaita
      [[-6.5, 156.4], [-6.5, 157.6], [-8.5, 158.5], [-8.5, 156.4], [-6.5, 156.4]]  // Choiseul/New Georgia
    ]
  },
  {
    code: "VU", name: "Vanuatu",
    n: -13.0, s: -20.5, w: 166.0, e: 170.5,
    polygons: [
      [[-17.6, 168.2], [-17.6, 168.6], [-17.9, 168.6], [-17.9, 168.2], [-17.6, 168.2]], // Efate
      [[-14.8, 166.5], [-14.8, 167.3], [-15.8, 167.3], [-15.8, 166.5], [-14.8, 166.5]]  // Espiritu Santo
    ]
  },
  {
    code: "NC", name: "New Caledonia",
    n: -19.5, s: -23.0, w: 163.5, e: 167.5,
    polygons: [[[-20.0, 164.0], [-21.0, 165.5], [-22.5, 167.0], [-22.4, 166.0], [-21.5, 164.5], [-20.0, 164.0]]]
  },
  {
    code: "WS", name: "Samoa",
    n: -13.0, s: -15.0, w: -173.0, e: -171.0,
    polygons: [
      [[-13.6, -172.7], [-13.5, -172.2], [-13.7, -172.2], [-13.8, -172.7], [-13.6, -172.7]], // Savai'i
      [[-13.9, -171.9], [-13.8, -171.4], [-14.0, -171.4], [-14.1, -171.9], [-13.9, -171.9]]  // Upolu
    ]
  },
  {
    code: "KI", name: "Kiribati",
    n: 5.0, s: -12.0, w: 169.0, e: -150.0,
    polygons: [
      [[1.5, 172.5], [2.0, 173.5], [1.0, 173.5], [1.0, 172.5], [1.5, 172.5]], // Gilbert
      [[-3.0, -172.0], [-3.0, -171.0], [-4.0, -171.0], [-4.0, -172.0], [-3.0, -172.0]], // Phoenix
      [[2.0, -157.0], [2.0, -157.5], [1.5, -157.5], [1.5, -157.0], [2.0, -157.0]] // Line
    ]
  },
  {
    code: "TO", name: "Tonga",
    n: -15.0, s: -24.0, w: -176.0, e: -173.0,
    polygons: [[[-18.0, -173.8], [-21.0, -175.2], [-21.5, -175.0], [-18.5, -173.6], [-18.0, -173.8]]]
  },
  {
    code: "FM", name: "Micronesia",
    n: 11.0, s: 0.0, w: 137.0, e: 164.0,
    polygons: [
      [[9.5, 138.0], [9.6, 138.2], [9.4, 138.2], [9.4, 138.0], [9.5, 138.0]], // Yap
      [[7.4, 151.7], [7.5, 151.9], [7.3, 151.9], [7.3, 151.7], [7.4, 151.7]], // Chuuk
      [[6.9, 158.2], [7.0, 158.4], [6.8, 158.4], [6.8, 158.2], [6.9, 158.2]] // Pohnpei
    ]
  },
  {
    code: "PW", name: "Palau",
    n: 9.0, s: 2.0, w: 130.0, e: 136.0,
    polygons: [[[7.5, 134.4], [7.7, 134.6], [7.3, 134.6], [7.2, 134.4], [7.5, 134.4]]]
  },
  {
    code: "MH", name: "Marshall Islands",
    n: 15.0, s: 4.0, w: 160.0, e: 173.0,
    polygons: [
      [[7.1, 171.1], [7.1, 171.4], [7.0, 171.4], [7.0, 171.1], [7.1, 171.1]], // Majuro
      [[9.1, 167.4], [9.1, 167.7], [8.7, 167.7], [8.7, 167.4], [9.1, 167.4]]  // Kwajalein
    ]
  },
  {
    code: "TV", name: "Tuvalu",
    n: -5.0, s: -11.0, w: 176.0, e: 180.0,
    polygons: [[[-8.5, 179.1], [-8.5, 179.3], [-8.7, 179.3], [-8.7, 179.1], [-8.5, 179.1]]]
  },
  {
    code: "NR", name: "Nauru",
    n: -0.51, s: -0.55, w: 166.90, e: 166.95,
    polygons: [[[-0.51, 166.92], [-0.53, 166.95], [-0.55, 166.93], [-0.53, 166.91], [-0.51, 166.92]]]
  },
  {
    code: "GU", name: "Guam",
    n: 13.7, s: 13.2, w: 144.6, e: 145.0,
    polygons: [[[13.6, 144.8], [13.4, 144.9], [13.2, 144.7], [13.4, 144.6], [13.6, 144.8]]]
  },
  {
    code: "MP", name: "Northern Mariana Islands",
    n: 21.0, s: 14.0, w: 144.0, e: 146.0,
    polygons: [[[15.2, 145.7], [15.3, 145.8], [15.1, 145.8], [15.0, 145.7], [15.2, 145.7]]]
  },
  {
    code: "AS", name: "American Samoa",
    n: -11.0, s: -15.0, w: -174.0, e: -167.0,
    polygons: [[[-14.2, -170.8], [-14.2, -170.6], [-14.4, -170.6], [-14.4, -170.8], [-14.2, -170.8]]]
  },
  {
    code: "CK", name: "Cook Islands",
    n: -8.0, s: -24.0, w: -166.0, e: -157.0,
    polygons: [
      [[-21.2, -159.7], [-21.1, -159.8], [-21.3, -159.9], [-21.3, -159.7], [-21.2, -159.7]], // Rarotonga
      [[-18.8, -159.7], [-18.8, -159.8], [-18.9, -159.8], [-18.9, -159.7], [-18.8, -159.7]], // Aitutaki
      [[-8.9, -157.9], [-8.9, -158.1], [-9.1, -158.1], [-9.1, -157.9], [-8.9, -157.9]]  // Penrhyn
    ]
  },
  {
    code: "PF", name: "French Polynesia",
    n: -7.0, s: -28.0, w: -155.0, e: -134.0,
    polygons: [
      [[-17.6, -149.5], [-17.3, -149.5], [-17.3, -150.0], [-17.8, -150.0], [-17.6, -149.5]], // Society (Tahiti)
      [[-8.8, -140.0], [-8.8, -139.5], [-10.0, -139.5], [-10.0, -140.5], [-8.8, -140.0]], // Marquesas
      [[-15.0, -146.0], [-15.0, -144.0], [-18.0, -142.0], [-18.0, -146.0], [-15.0, -146.0]]  // Tuamotu
    ]
  },
  {
    code: "NU", name: "Niue",
    n: -18.9, s: -19.2, w: -170.0, e: -169.7,
    polygons: [[[-19.0, -169.8], [-19.0, -169.9], [-19.1, -169.9], [-19.1, -169.8], [-19.0, -169.8]]]
  },
  {
    code: "TK", name: "Tokelau",
    n: -8.0, s: -10.0, w: -173.0, e: -171.0,
    polygons: [[[-9.3, -171.2], [-9.3, -171.3], [-9.4, -171.3], [-9.4, -171.2], [-9.3, -171.2]]]
  },
  {
    code: "WF", name: "Wallis and Futuna",
    n: -13.0, s: -14.5, w: -178.5, e: -176.0,
    polygons: [[[-13.2, -176.2], [-13.2, -176.3], [-13.3, -176.3], [-13.3, -176.2], [-13.2, -176.2]]]
  },
  {
    code: "NF", name: "Norfolk Island",
    n: -29.0, s: -29.1, w: 167.9, e: 168.0,
    polygons: [[[-29.0, 167.9], [-29.0, 168.0], [-29.1, 168.0], [-29.1, 167.9], [-29.0, 167.9]]]
  },
  {
    code: "CX", name: "Christmas Island",
    n: -10.4, s: -10.6, w: 105.5, e: 105.8,
    polygons: [[[-10.4, 105.6], [-10.4, 105.7], [-10.6, 105.7], [-10.6, 105.6], [-10.4, 105.6]]]
  },
  {
    code: "CC", name: "Cocos Islands",
    n: -12.0, s: -12.3, w: 96.7, e: 97.0,
    polygons: [[[-12.1, 96.8], [-12.1, 96.9], [-12.2, 96.9], [-12.2, 96.8], [-12.1, 96.8]]]
  },
  {
    code: "PN", name: "Pitcairn Islands",
    n: -24.0, s: -25.5, w: -131.0, e: -124.0,
    polygons: [[[-25.0, -130.1], [-25.0, -130.2], [-25.1, -130.2], [-25.1, -130.1], [-25.0, -130.1]]]
  },
];

// Spatial Cache for faster lookup (Grid Index)
// Grid Index Level (L1)
const GRID_INDEX: { [key: string]: { seas: any[], countries: any[], continents: any[] } } = {};
const GRID_SIZE = 2; // 2 degree cells as requested

// Last Result Cache (L0)
let LAST_LAT = -999;
let LAST_LON = -999;
let LAST_RESULT: { prefix: string, isSea: boolean, gridSize: number, name: string } | null = null;

function getSpatialKey(lat: number, lon: number) {
  const latIdx = Math.floor(lat / GRID_SIZE);
  const lonIdx = Math.floor(lon / GRID_SIZE);
  return `${latIdx},${lonIdx}`;
}

function getSpatialCell(lat: number, lon: number) {
  const key = getSpatialKey(lat, lon);
  if (GRID_INDEX[key]) return GRID_INDEX[key];

  const latIdx = Math.floor(lat / GRID_SIZE);
  const lonIdx = Math.floor(lon / GRID_SIZE);
  const s = latIdx * GRID_SIZE;
  const n = s + GRID_SIZE;
  const w = lonIdx * GRID_SIZE;
  const e = w + GRID_SIZE;

  const cell = {
    seas: SEA_REGIONS.filter(reg => {
      const latOverlap = Math.max(s, reg.s) <= Math.min(n, reg.n);
      let lonOverlap = false;
      if (reg.w > reg.e) { // Wrap
        lonOverlap = Math.max(w, reg.w) <= Math.min(e, 180) || Math.max(w, -180) <= Math.min(e, reg.e);
      } else {
        lonOverlap = Math.max(w, reg.w) <= Math.min(e, reg.e);
      }
      return latOverlap && lonOverlap;
    }),
    countries: COUNTRY_REGIONS.filter(reg => {
      const latOverlap = Math.max(s, reg.s) <= Math.min(n, reg.n);
      let lonOverlap = false;
      if (reg.w > reg.e) { // Wrap
        lonOverlap = Math.max(w, reg.w) <= Math.min(e, 180) || Math.max(w, -180) <= Math.min(e, reg.e);
      } else {
        lonOverlap = Math.max(w, reg.w) <= Math.min(e, reg.e);
      }
      return latOverlap && lonOverlap;
    }),
    continents: LAND_REGIONS.filter(reg => {
      const latOverlap = Math.max(s, reg.s) <= Math.min(n, reg.n);
      let lonOverlap = false;
      if (reg.w > reg.e) { // Wrap
        lonOverlap = Math.max(w, reg.w) <= Math.min(e, 180) || Math.max(w, -180) <= Math.min(e, reg.e);
      } else {
        lonOverlap = Math.max(w, reg.w) <= Math.min(e, reg.e);
      }
      return latOverlap && lonOverlap;
    })
  };
  
  GRID_INDEX[key] = cell;
  return cell;
}

/**
 * Utility to check if a point is inside a polygon using ray-casting algorithm.
 * Includes a bounding box pre-check for performance.
 */
function isPointInPolygon(lat: number, lon: number, polygon: [number, number][] | [number, number][][], bounds?: { n: number, s: number, w: number, e: number }) {
  const EPS = 1e-9;
  
  // Bounding box pre-check
  if (bounds) {
    const inLon = bounds.w <= bounds.e 
      ? (lon >= bounds.w - EPS && lon <= bounds.e + EPS) 
      : (lon >= bounds.w - EPS || lon <= bounds.e + EPS);
    if (lat < bounds.s - EPS || lat > bounds.n + EPS || !inLon) return false;
  }

  const polygons = (Array.isArray(polygon) && Array.isArray(polygon[0]) && Array.isArray(polygon[0][0]))
    ? polygon as [number, number][][]
    : [polygon as [number, number][]];

  for (const poly of polygons) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][1], yi = poly[i][0];
      const xj = poly[j][1], yj = poly[j][0];
      
      // Check if point is exactly on a vertex
      if (Math.abs(xi - lon) < EPS && Math.abs(yi - lat) < EPS) return true;
      
      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

/**
 * Optimized Country/Ocean detection with Sea-First logic.
 * Determination is based on the center of the 4m grid cell at high tide.
 */
const OCEANS = [
  // Polar Oceans first (Highest priority to avoid overlap with mid-latitude fallbacks)
  { id: "ARCT", n: 90, s: 66.5, w: -180, e: 180, name: "Arctic Ocean" },
  { id: "SOUT", n: -60, s: -90, w: -180, e: 180, name: "Southern Ocean" },
  
  // Atlantic
  { id: "NATL", n: 66.5, s: 0, w: -70, e: 20, name: "North Atlantic" },
  { id: "SATL", n: 0, s: -60, w: -67, e: 20, name: "South Atlantic" },
  
  // Indian
  { id: "NIND", n: 30, s: 0, w: 20, e: 100, name: "North Indian Ocean" },
  { id: "SIND", n: 0, s: -60, w: 20, e: 147, name: "South Indian Ocean" },
  
  // Pacific (split by IDL and Atlantic boundaries)
  { id: "NPAC", n: 66.5, s: 0, w: 100, e: 180, name: "North Pacific" },
  { id: "NEPC", n: 66.5, s: 0, w: -180, e: -70, name: "North Pacific" },
  { id: "SPAC", n: 0, s: -60, w: 147, e: 180, name: "South Pacific" },
  { id: "SEPC", n: 0, s: -60, w: -180, e: -67, name: "South Pacific" },
];

/**
 * Optimized Country/Ocean detection using the "World - Land = Sea" principle.
 * Logic:
 * 1. Check Land (Countries): If in land, it's definitely land. Smallest polygon wins.
 * 2. Check Major Seas: If not land, check named sea polygons.
 * 3. Fallback: Remaining areas are "Grid Sea" (part of an ocean).
 */
export function getRegionInfo(lat: number, lon: number): { prefix: string, isSea: boolean, gridSize: number, name: string, polygon?: number[][] } {
  // Normalize lon to -180 to 180
  let normLon = lon;
  while (normLon > 180) normLon -= 360;
  while (normLon < -180) normLon += 360;

  // 1. POLAR SPECIAL RULE (Fast exit)
  if (lat > 89.95) return { prefix: "ARCT", isSea: true, gridSize: 38.2, name: "North Pole", polygon: [[89.9,-180],[90,-180],[90,180],[89.9,180],[89.9,-180]] };
  if (lat < -85.0) return { prefix: "AQ", isSea: false, gridSize: 4.78, name: "Antarctica" };

  // 2. GRID LOOKUP (Narrow down to 1-3 candidates)
  const cell = getSpatialCell(lat, normLon);

  // 3. SPATIAL CACHE (Last Result Check)
  if (LAST_RESULT && Math.abs(lat - LAST_LAT) < 0.0001 && Math.abs(normLon - LAST_LON) < 0.0001) {
    return LAST_RESULT as any;
  }

  // Helper for smallest polygon logic
  const getArea = (n: number, s: number, w: number, e: number) => (n - s) * (w > e ? (180 - w + e + 180) : (e - w));

  let countryMatch: any = null;
  let countryMinArea = Infinity;

  // 4. LAND CHECK (Countries) - Strict Polygon Check
  // [PRIORITIZE JAPAN & DISPUTED]
  const HIGH_PRIORITY_CODES = ["JP", "EH", "BT_T", "CRIM", "DONB", "KASH", "SCSD", "EEBD", "TRNC", "SLND", "PMR", "PHIS", "BAAR", "CYGL"];
  const prioritized = cell.countries.filter(c => HIGH_PRIORITY_CODES.includes(c.code));
  const others = cell.countries.filter(c => !HIGH_PRIORITY_CODES.includes(c.code));

  for (const c of prioritized) {
    const poly = (c as any).polygons || c.polygon;
    if (poly && isPointInPolygon(lat, normLon, poly, c)) {
      const res = { prefix: c.code, isSea: false, gridSize: 4.78, name: c.name, polygon: c.polygons?.[0] || c.polygon };
      LAST_LAT = lat; LAST_LON = normLon; LAST_RESULT = res as any;
      return res;
    }
  }

  for (const c of others) {
    const poly = (c as any).polygons || c.polygon;
    if (poly && isPointInPolygon(lat, normLon, poly, c)) {
      const area = getArea(c.n, c.s, c.w, c.e);
      if (area < countryMinArea) {
        countryMinArea = area;
        countryMatch = c;
      }
    }
  }

  if (countryMatch) {
    const res = { prefix: countryMatch.code, isSea: false, gridSize: 4.78, name: countryMatch.name, polygon: countryMatch.polygons?.[0] || countryMatch.polygon };
    LAST_LAT = lat; LAST_LON = normLon; LAST_RESULT = res as any;
    return res;
  }

  // 5. SEA CHECK (Specific Major Seas)
  let seaMatch: any = null;
  let seaMinArea = Infinity;

  for (const s of cell.seas) {
    const poly = (s as any).polygons || s.polygon;
    if (poly && isPointInPolygon(lat, normLon, poly, s)) {
      const area = getArea(s.n, s.s, s.w, s.e);
      if (area < seaMinArea) {
        seaMinArea = area;
        seaMatch = s;
      }
    }
  }

  if (seaMatch) {
    const res = { prefix: seaMatch.id, isSea: true, gridSize: 38.2, name: seaMatch.name, polygon: seaMatch.polygons?.[0] || seaMatch.polygon };
    LAST_LAT = lat; LAST_LON = normLon; LAST_RESULT = res as any;
    return res;
  }

  // 6. FALLBACK (Open Ocean / Ocean Grid with 1000km Subdivision)
  // Ensure the fallback covers all coordinate space for non-land areas
  let fallbackOcean = OCEANS.find(o => {
    const inLon = o.w <= o.e ? (normLon >= o.w && normLon <= o.e) : (normLon >= o.w || normLon <= o.e);
    return lat >= o.s && lat <= o.n && inLon;
  });

  // Emergency Global Fallback if no specific ocean matches (e.g. at boundaries)
  if (!fallbackOcean) {
    if (lat >= 0) fallbackOcean = { id: "NPAC", n: 90, s: 0, w: 0, e: 0, name: "North Pacific" };
    else fallbackOcean = { id: "SPAC", n: 0, s: -90, w: 0, e: 0, name: "South Pacific" };
  }

  const o = fallbackOcean;
  // 1000km Subdivision Logic
  const latBand = Math.floor(lat / 9) * 9;
  const cosLat = Math.cos(Math.abs(lat) * Math.PI / 180);
  const lonStep = cosLat > 0 ? Math.min(60, 9 / cosLat) : 60;
  const lonBand = Math.floor(normLon / lonStep) * lonStep;
  
  const subCode = `O_${o.id}_${latBand}_${Math.floor(lonBand)}`;
  const res = { 
    prefix: subCode, 
    isSea: true, 
    gridSize: 38.2, 
    name: `${o.name} (${Math.abs(latBand)}${latBand >= 0 ? 'N' : 'S'} ${Math.abs(Math.floor(lonBand))}${lonBand >= 0 ? 'E' : 'W'})`,
    polygon: [
      [latBand, lonBand],
      [latBand + 9, lonBand],
      [latBand + 9, lonBand + lonStep],
      [latBand, lonBand + lonStep],
      [latBand, lonBand]
    ]
  };
  LAST_LAT = lat; LAST_LON = normLon; LAST_RESULT = res as any;
  return res;
}

/**
 * Utility to get continent for a country based on bounding box
 */
function getContinentForCountry(lat: number, lon: number): string {
  for (const l of LAND_REGIONS) {
    const inLon = l.w <= l.e ? (lon >= l.w && lon <= l.e) : (lon >= l.w || lon <= l.e);
    if (lat >= l.s && lat <= l.n && inLon) return l.name;
  }
  return "Other";
}

/**
 * Generates the full list of all countries for the registry.
 */
export function generateFullCountryRegistry(): any[] {
  return COUNTRY_REGIONS.map(c => {
    const parentInfo = COUNTRIES.find(cnt => cnt.code === c.code);
    return {
      id: c.code,
      name: c.name,
      prefix: c.code, 
      lat: (c.n + c.s) / 2,
      lon: (c.w + c.e) / 2,
      type: parentInfo?.type || 'Country',
      area: parentInfo?.region || getContinentForCountry((c.n + c.s) / 2, (c.w + c.e) / 2)
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Generates the full list of all sea areas including grid subdivisions.
 */
export function generateFullSeaRegistry(): any[] {
  const result: any[] = [];
  
  // 1. Add all IHO named regions
  for (const s of SEA_REGIONS) {
    const prefix = generatePrefix(s.id, true, s.name);
    const parentOcean = OCEANS.find(o => {
      const inLon = o.w <= o.e ? (s.w >= o.w && s.w <= o.e) : (s.w >= o.w || s.w <= o.e);
      return s.n >= o.s && s.n <= o.n && inLon;
    })?.name || "Other";

    result.push({
      id: s.id,
      name: s.name,
      prefix: prefix,
      lat: s.n,
      lon: s.w,
      type: 'Named Sea',
      area: parentOcean
    });
  }
  
  // 2. Add all Ocean Grid segments
  for (const o of OCEANS) {
    for (let lat = o.s; lat < o.n; lat += 9) {
      const cosLat = Math.cos(Math.abs(lat) * Math.PI / 180);
      const lonStep = cosLat > 0 ? Math.min(60, 9 / cosLat) : 60;
      
      const startLon = o.w;
      const endLon = o.e;
      const totalWidth = endLon >= startLon ? (endLon - startLon) : (180 - startLon + endLon + 180);
      
      for (let offset = 0; offset < totalWidth; offset += lonStep) {
        let lon = startLon + offset;
        while (lon > 180) lon -= 360;
        while (lon < -180) lon += 360;
        
        const subCode = `O_${o.id}_${lat}_${Math.floor(lon)}`;
        const name = `${o.name} (${Math.abs(lat)}${lat >= 0 ? 'N' : 'S'} ${Math.abs(Math.floor(lon))}${lon >= 0 ? 'E' : 'W'})`;
        const prefix = generatePrefix(subCode, true, name);
        
        result.push({
          id: subCode,
          name: name,
          prefix: prefix,
          lat: lat + 4.5,
          lon: lon + lonStep / 2,
          type: 'Ocean Segment',
          area: o.name
        });
      }
    }
  }
  
  return result;
}

/**
 * Calculates the total number of distinct sea areas including grid subdivisions.
 */
export function calculateTotalSeaAreas(): number {
  return generateFullSeaRegistry().length;
}

const gridCache = new Map<string, { gridLines: any[][], gridCells: any[] }>();

/**
 * Generates grid features for map visualization based on the new AGID spec.
 */
export function getGridFeatures(lat: number, lon: number, range: number) {
  const centerResult = encodeAGID(lat, lon);
  const { qx: quantX, qy: quantY } = getQuantized(lat, lon);
  
  // Cache key
  const cacheKey = `${centerResult.id}_${range}`;
  if (gridCache.has(cacheKey)) {
    return gridCache.get(cacheKey)!;
  }

  const gridLines: any[][] = [];
  const gridCells: any[] = [];
  const seenIds = new Set<string>();

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const qx = quantX + dx;
      const qy = quantY + dy;
      
      const bounds = getCellBounds(qx, qy);
      const cellId = `${qx},${qy}`;
      if (seenIds.has(cellId)) continue;
      seenIds.add(cellId);

      const { minLat, maxLat, minLon, maxLon } = bounds;
      
      const coords = [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat]
      ];

      gridLines.push([[minLon, minLat], [maxLon, minLat]]);
      gridLines.push([[minLon, minLat], [minLon, maxLat]]);
      if (dx === range) gridLines.push([[maxLon, minLat], [maxLon, maxLat]]);
      if (dy === range) gridLines.push([[minLon, maxLat], [maxLon, maxLat]]);

      gridCells.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: { id: cellId, isSea: centerResult.isSea }
      });
    }
  }

  const result = { gridLines, gridCells };
  gridCache.set(cacheKey, result);
  return result;
}
