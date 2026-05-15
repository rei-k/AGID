/**
 * AGID (Address Grid ID) Complete Mathematical Definition Implementation
 * Global, CORDIC-rotated, Polar-ready, 12-character format.
 */

import { SEA_REGIONS, LAND_REGIONS, COUNTRY_REGIONS } from './regions';
import { COUNTRIES } from '../constants/countries';
export { SEA_REGIONS, LAND_REGIONS, COUNTRY_REGIONS };

const BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const NUMBERS = "0123456789";
const LETTERS = "ABCDEFGHJKMNPQRSTVWXYZ"; // 22 letters

const OPEN_OCEAN_CODES = 220; // 22 Letters * 10 Numbers
const COASTAL_SEA_CODES = 220; // 10 Numbers * 22 Letters
const OTHER_CODES = 100; // 10 Numbers * 10 Numbers

const K = 2097152; // 2^21 divisions
const M = 2097151; // 2^21 - 1
const L = 21;

/**
 * Equal-Area Transformation (E)
 * Based on the Tangent transformation to achieve near-uniform area on the sphere.
 */
function applyEqualArea(val: number): number {
  return Math.tan(val * Math.PI / 4);
}

function invertEqualArea(val: number): number {
  return Math.atan(val) * 4 / Math.PI;
}

/**
 * Cubed Sphere Projection
 * Maps Lat/Lon to (face, qx, qy)
 */
function getQuantized(lat: number, lon: number) {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;

  const x = Math.cos(phi) * Math.cos(theta);
  const y = Math.cos(phi) * Math.sin(theta);
  const z = Math.sin(phi);

  const absX = Math.abs(x);
  const absY = Math.abs(y);
  const absZ = Math.abs(z);

  let face = 0;
  let uc = 0;
  let vc = 0;

  if (absX >= absY && absX >= absZ) {
    if (x > 0) { face = 0; uc = y; vc = z; }
    else { face = 1; uc = -y; vc = z; }
  } else if (absY >= absX && absY >= absZ) {
    if (y > 0) { face = 2; uc = -x; vc = z; }
    else { face = 3; uc = x; vc = z; }
  } else {
    if (z > 0) { face = 4; uc = -x; vc = -y; }
    else { face = 5; uc = -x; vc = y; }
  }

  const maxVal = Math.max(absX, absY, absZ);
  const xi = uc / maxVal;
  const eta = vc / maxVal;

  // Apply Equal-Area correction (inverse of the tangent map used in getFromQuantized)
  const u = 0.5 * (invertEqualArea(xi) + 1.0);
  const v = 0.5 * (invertEqualArea(eta) + 1.0);

  return {
    face,
    qx: Math.max(0, Math.min(M, Math.floor(u * K))),
    qy: Math.max(0, Math.min(M, Math.floor(v * K)))
  };
}

/**
 * Inverse Cubed Sphere Projection
 */
function getFromQuantized(face: number, qx: number, qy: number) {
  const u = (qx / K) * 2.0 - 1.0;
  const v = (qy / K) * 2.0 - 1.0;

  // Apply Equal-Area correction (Tangent Map)
  const xi = applyEqualArea(u);
  const eta = applyEqualArea(v);

  let x = 0, y = 0, z = 0;
  switch (face) {
    case 0: x = 1; y = xi; z = eta; break;
    case 1: x = -1; y = -xi; z = eta; break;
    case 2: x = -xi; y = 1; z = eta; break;
    case 3: x = xi; y = -1; z = eta; break;
    case 4: x = -xi; y = -eta; z = 1; break;
    case 5: x = -xi; y = eta; z = -1; break;
  }

  const length = Math.sqrt(x * x + y * y + z * z);
  x /= length; y /= length; z /= length;

  const lat = (Math.asin(z) * 180) / Math.PI;
  const lon = (Math.atan2(y, x) * 180) / Math.PI;

  return { lat, lon };
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
    // [SPECIFIC 2-CHAR SEA CODES]
    const seaCodeMap: { [key: string]: string } = {
      'NPAC': 'P1', 'NEPC': 'P0', 'SPAC': 'P3', 'SEPC': 'P2',
      'NATL': 'A1', 'SATL': 'A2', 'NIND': 'I1', 'SIND': 'I2',
      'SOUT': 'S0', 'ARCT': 'R0'
    };
    
    // Check if it's a major ocean segment
    for (const [longCode, shortCode] of Object.entries(seaCodeMap)) {
      if (code.includes(longCode)) {
        PREFIX_CACHE[cacheKey] = shortCode;
        return shortCode;
      }
    }

    const isOpen = code.startsWith("O_") || Object.keys(seaCodeMap).some(k => code.includes(k));
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
    // [STRICT 2-LETTER COUNTRY CODES]
    // If it's land, ensure we always use a 2-letter code from ISO 3166-1 if detected.
    const upperCode = code.toUpperCase();
    const isIsoCountry = COUNTRIES.some(c => c.code === upperCode) || code.length === 2;
    
    if (isIsoCountry && /^[A-Z]{2}$/.test(upperCode)) {
      PREFIX_CACHE[cacheKey] = upperCode;
      return upperCode;
    }
    
    // For non-ISO codes (disputed/territories), use Number-Number format to avoid collisions
    const hashData = (name + code).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const n1 = NUMBERS[hashData % 10];
    const n2 = NUMBERS[(hashData / 10 | 0) % 10];
    const finalCode = n1 + n2;

    PREFIX_CACHE[cacheKey] = finalCode;
    return finalCode;
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
 * Hilbert Curve Encoding
 * Interleaves x and y into a single 1D index.
 */
function rot(n: number, x: number, y: number, rx: number, ry: number) {
  if (ry === 0) {
    if (rx === 1) {
      x = n - 1 - x;
      y = n - 1 - y;
    }
    return [y, x];
  }
  return [x, y];
}

function encodeHilbert(n: number, x: number, y: number): bigint {
  let d = 0n;
  for (let s = n / 2; s > 0; s = Math.floor(s / 2)) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += BigInt(s) * BigInt(s) * BigInt((3 * rx) ^ ry);
    [x, y] = rot(s, x, y, rx, ry);
  }
  return d;
}

function decodeHilbert(n: number, d: bigint): { x: number, y: number } {
  let x = 0;
  let y = 0;
  let t = d;
  for (let s = 1; s < n; s *= 2) {
    const rx = Number(1n & (t / 2n));
    const ry = Number(1n & (t ^ BigInt(rx)));
    [x, y] = rot(s, x, y, rx, ry);
    x += s * rx;
    y += s * ry;
    t /= 4n;
  }
  return { x, y };
}

/**
 * 45-bit Packing: Face (3 bits) + Hilbert (42 bits)
 */
function packAGID(face: number, h: bigint): bigint {
  return (BigInt(face) << 42n) | h;
}

function unpackAGID(packed: bigint): { face: number, h: bigint } {
  const face = Number(packed >> 42n);
  const h = packed & ((1n << 42n) - 1n);
  return { face, h };
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
 * Redesigned for Cubed Sphere (23-bit precision per face axis).
 * This ensures near-uniform cell size (~4.78m) globally.
 */
export function encodeAGID(lat: number, lon: number): AGIDResult {
  const region = getRegionInfo(lat, lon);
  const prefix = generatePrefix(region.prefix, region.isSea, region.name);

  // 1. Quantization: Cubed Sphere mapping with Equal-Area correction
  const { face, qx, qy } = getQuantized(lat, lon);

  // 2. Hilbert & Base32
  // 10 characters Base32 = 50 bits.
  // 3 bits for face + 42 bits for Hilbert (L=21) = 45 bits.
  const hilbert = encodeHilbert(K, qx, qy);
  const packedValue = packAGID(face, hilbert);
  const hash = encodeBase32(packedValue, 10);

  return {
    id: prefix + hash,
    prefix,
    hash,
    isSea: region.isSea,
    gridSize: 4.4, // ~4.4m average resolution (2^21 divisions per face)
    regionName: region.name,
    regionPolygon: region.polygon,
    face,
    lat,
    lon,
    bounds: getCellBounds(face, qx, qy),
    polygon: getCellPolygon(face, qx, qy)
  };
}

/**
 * Bounds Calculation for Cubed Sphere
 */
export function getCellPolygon(face: number, quantX: number, quantY: number, step: number = 1): number[][] {
  const p1 = getFromQuantized(face, quantX, quantY);
  const p2 = getFromQuantized(face, quantX + step, quantY);
  const p3 = getFromQuantized(face, quantX + step, quantY + step);
  const p4 = getFromQuantized(face, quantX, quantY + step);

  const pts = [p1, p2, p3, p4];
  const refLon = p1.lon;
  
  // Handle Longitudinal Wrap (IDL)
  const adjusted = pts.map(p => {
    let shiftedLon = p.lon;
    if (shiftedLon - refLon > 180) shiftedLon -= 360;
    else if (shiftedLon - refLon < -180) shiftedLon += 360;
    return [shiftedLon, p.lat];
  });

  return [
    adjusted[0],
    adjusted[1],
    adjusted[2],
    adjusted[3],
    adjusted[0]
  ];
}

export function getCellCorners(face: number, quantX: number, quantY: number, step: number = 1) {
  const p1 = getFromQuantized(face, quantX, quantY);
  const p2 = getFromQuantized(face, quantX + step, quantY);
  const p3 = getFromQuantized(face, quantX + step, quantY + step);
  const p4 = getFromQuantized(face, quantX, quantY + step);

  return [p1, p2, p3, p4];
}

export function getCellBounds(face: number, quantX: number, quantY: number, step: number = 1) {
  const corners = getCellCorners(face, quantX, quantY, step);
  
  return {
    minLat: Math.min(...corners.map(c => c.lat)),
    maxLat: Math.max(...corners.map(c => c.lat)),
    minLon: Math.min(...corners.map(c => c.lon)),
    maxLon: Math.max(...corners.map(c => c.lon))
  };
}

/**
 * Core AGID Decoding
 */
export function decodeAGID(id: string): { lat: number, lon: number, isSea: boolean, prefix: string, face: number } | null {
  if (id.length !== 12) return null;
  const prefix = id.substring(0, 2);
  const hash = id.substring(2);

  try {
    const packedValue = decodeBase32(hash);
    const { face, h } = unpackAGID(packedValue);
    const { x: quantX, y: quantY } = decodeHilbert(K, h);

    const { lat, lon } = getFromQuantized(face, quantX, quantY);

    return { lat, lon, isSea: false, prefix, face };
  } catch (e) {
    return null;
  }
}

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
  const EPS = 1e-10;
  
  // Bounding box pre-check
  if (bounds) {
    const inLon = bounds.w <= bounds.e 
      ? (lon >= bounds.w - EPS && lon <= bounds.e + EPS) 
      : (lon >= bounds.w - EPS || lon <= bounds.e + EPS);
    if (lat < bounds.s - EPS || lat > bounds.n + EPS || !inLon) return false;
  }

  // If no polygon data is provided but we matched the bounds, we treat it as a hit.
  if (!polygon) return true;

  const polygons = (Array.isArray(polygon) && Array.isArray(polygon[0]) && Array.isArray(polygon[0][0]))
    ? polygon as [number, number][][]
    : [polygon as [number, number][]];

  for (const poly of polygons) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      // Data in JSON is [LAT, LON]
      const yi = poly[i][0], xi = poly[i][1];
      const yj = poly[j][0], xj = poly[j][1];
      
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
  if (lat > 89.95) return { prefix: "ARCT", isSea: true, gridSize: 4.4, name: "North Pole", polygon: [[-180, 89.9],[-180, 90],[180, 90],[180, 89.9],[-180, 89.9]] };
  if (lat < -85.0) return { prefix: "AQ", isSea: false, gridSize: 4.4, name: "Antarctica" };

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
    const polyRaw = (c as any).polygons || c.polygon;
    if (isPointInPolygon(lat, normLon, polyRaw, c)) {
      // Extract the first ring of the first polygon
      let polySet = polyRaw;
      while (Array.isArray(polySet) && Array.isArray(polySet[0]) && Array.isArray(polySet[0][0])) {
        polySet = polySet[0];
      }
      
      const res = { 
        prefix: c.code, 
        isSea: false, 
        gridSize: 4.4, 
        name: c.name, 
        polygon: polySet ? (polySet as [number, number][]).map(p => [p[1], p[0]]) : undefined 
      };
      LAST_LAT = lat; LAST_LON = normLon; LAST_RESULT = res as any;
      return res;
    }
  }

  for (const c of others) {
    const polyRaw = (c as any).polygons || c.polygon;
    if (isPointInPolygon(lat, normLon, polyRaw, c)) {
      const area = getArea(c.n, c.s, c.w, c.e);
      if (area < countryMinArea) {
        countryMinArea = area;
        countryMatch = c;
      }
    }
  }

  if (countryMatch) {
    const polyRaw = countryMatch.polygons?.[0] || countryMatch.polygon;
    let polySet = polyRaw;
    while (Array.isArray(polySet) && Array.isArray(polySet[0]) && Array.isArray(polySet[0][0])) {
      polySet = polySet[0];
    }

    const res = { 
      prefix: countryMatch.code, 
      isSea: false, 
      gridSize: 4.4, 
      name: countryMatch.name, 
      polygon: polySet ? (polySet as [number, number][]).map(p => [p[1], p[0]]) : undefined 
    };
    LAST_LAT = lat; LAST_LON = normLon; LAST_RESULT = res as any;
    return res;
  }

  // 5. SEA CHECK (Specific Major Seas)
  let seaMatch: any = null;
  let seaMinArea = Infinity;

  for (const s of cell.seas) {
    const polyRaw = (s as any).polygons || s.polygon;
    if (isPointInPolygon(lat, normLon, polyRaw, s)) {
      const area = getArea(s.n, s.s, s.w, s.e);
      if (area < seaMinArea) {
        seaMinArea = area;
        seaMatch = s;
      }
    }
  }

  if (seaMatch) {
    const polyRaw = seaMatch.polygons?.[0] || seaMatch.polygon;
    let polySet = polyRaw;
    while (Array.isArray(polySet) && Array.isArray(polySet[0]) && Array.isArray(polySet[0][0])) {
      polySet = polySet[0];
    }

    const res = { 
      prefix: seaMatch.id, 
      isSea: true, 
      gridSize: 4.4, 
      name: seaMatch.name, 
      polygon: polySet ? (polySet as [number, number][]).map(p => [p[1], p[0]]) : undefined 
    };
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
  const normalizeLon = (l: number) => {
    while (l > 180) l -= 360;
    while (l < -180) l += 360;
    return l;
  };

  const res = { 
    prefix: subCode, 
    isSea: true, 
    gridSize: 4.4, 
    name: `${o.name} (${Math.abs(latBand)}${latBand >= 0 ? 'N' : 'S'} ${Math.abs(Math.floor(lonBand))}${lonBand >= 0 ? 'E' : 'W'})`,
    polygon: [
      [lonBand, latBand],
      [lonBand, latBand + 9],
      [normalizeLon(lonBand + lonStep), latBand + 9],
      [normalizeLon(lonBand + lonStep), latBand],
      [lonBand, latBand]
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
  const seen = new Set();
  const result: any[] = [];
  
  for (const c of COUNTRY_REGIONS) {
    if (seen.has(c.code)) continue;
    seen.add(c.code);
    
    const parentInfo = COUNTRIES.find(cnt => cnt.code === c.code);
    result.push({
      id: c.code,
      name: c.name,
      prefix: c.code, 
      lat: (c.n + c.s) / 2,
      lon: (c.w + c.e) / 2,
      type: parentInfo?.type || 'Country',
      area: parentInfo?.region || getContinentForCountry((c.n + c.s) / 2, (c.w + c.e) / 2)
    });
  }
  
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Generates the full list of all sea areas including grid subdivisions.
 */
export function generateFullSeaRegistry(): any[] {
  const result: any[] = [];
  const seenIds = new Set();
  
  // 1. Add all IHO named regions
  for (const s of SEA_REGIONS) {
    if (seenIds.has(s.id)) continue;
    seenIds.add(s.id);
    
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
  const { face, qx: quantX, qy: quantY } = getQuantized(lat, lon);
  
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
      
      const polyCoords = getCellPolygon(face, qx, qy);
      const cellId = `${face},${qx},${qy}`;
      if (seenIds.has(cellId)) continue;
      seenIds.add(cellId);

      gridLines.push([polyCoords[0], polyCoords[1]]);
      gridLines.push([polyCoords[1], polyCoords[2]]);
      gridLines.push([polyCoords[2], polyCoords[3]]);
      gridLines.push([polyCoords[3], polyCoords[0]]);

      gridCells.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [polyCoords] },
        properties: { id: cellId, isSea: centerResult.isSea }
      });
    }
  }

  const result = { gridLines, gridCells };
  gridCache.set(cacheKey, result);
  return result;
}
