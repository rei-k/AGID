import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initPostalCodeDB, getNearestPostalCode } from './src/services/PostalCodeDB';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for rate limiting in Cloud Run environment (Setting to 1 for security)
  app.set('trust proxy', 1);

  // REMOVED HELMET FOR COMPATIBILITY TESTING
  
  // Extra Security Headers / Compatibility Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'ALLOWALL'); 
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  // Rate Limiting to prevent API abuse
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000, // Increased for map-heavy application
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
  });
  app.use('/api/', limiter);

  // Initialize Postal Code DB (downloads data in background)
  try {
    initPostalCodeDB();
  } catch (e) {
    console.error('Failed to initialize Postal Code DB:', e);
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.text({ type: ['text/plain', 'application/x-www-form-urlencoded'], limit: '10mb' }));

  // Global error handler for the process to avoid server dying on unexpected errors
  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught Exception:', err);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    console.log('[API] Health check');
    res.json({ status: 'ok' });
  });

  // AI Data Quality Analysis Route (Stub)
  app.get('/api/data-quality/report', async (req, res) => {
    res.json({ 
      timestamp: Date.now(),
      report: "Backend AI analysis is disabled. Please trigger this check from the frontend.",
      stats: qualityStats,
      continentQuality: continentQuality
    });
  });

  app.get('/api/postal-code/nearest', async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const cc = (req.query.cc as string || '').toUpperCase();

      if (isNaN(lat) || isNaN(lon) || !cc) {
        return res.status(400).json({ error: 'Missing or invalid lat, lon, or cc' });
      }

      const result = await getNearestPostalCode(lat, lon, cc);
      if (result) {
        res.json(result);
      } else {
        res.status(404).json({ error: 'No postal code found nearby' });
      }
    } catch (error) {
      console.error('API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Zippopotam.us API Proxy (Free, No Key, Open Data)
  // Provides postal code data for many countries
  app.get('/api/postal-code/zippo', async (req, res) => {
    const country = (req.query.cc as string || '').toLowerCase();
    const postcode = req.query.pc as string;

    if (!country || !postcode) {
      return res.status(400).json({ error: 'Missing country code (cc) or postcode (pc)' });
    }

    try {
      const response = await safeFetch(`https://api.zippopotam.us/${country}/${postcode}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Postal code not found in Zippopotam' });
    } catch (error) {
      console.error('Zippopotam API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const USER_AGENT = 'AGID-Geogrid-Explorer/2.5.1 (kitaura.code@gmail.com; Geogrid Project)';

  const apiCache = new Map<string, { data: any, timestamp: number }>();
  const API_CACHE_TTL = 1000 * 60 * 60; // 1 hour cache

  // Data Quality Stats Tracker
  interface QualityStats {
    totalRequests: number;
    successRequests: number;
    failRequests: number;
    avgResponseTime: number;
    byRegion: Record<string, {
      success: number;
      fail: number;
      avgTime: number;
    }>;
  }

  const qualityStats: Record<string, QualityStats> = {
    elevation: { totalRequests: 0, successRequests: 0, failRequests: 0, avgResponseTime: 0, byRegion: {} },
    overpass: { totalRequests: 0, successRequests: 0, failRequests: 0, avgResponseTime: 0, byRegion: {} },
    address: { totalRequests: 0, successRequests: 0, failRequests: 0, avgResponseTime: 0, byRegion: {} }
  };

  const continentQuality: Record<string, { score: number, lastChecked: number, issues: string[] }> = {};

  async function runGlobalQualitySweep() {
    console.log('[Quality Monitor] Starting Daily Global Quality Sweep...');
    const sweepPoints = [
      { name: 'Europe-West', lat: 48.8566, lon: 2.3522, country: 'FR' }, // Paris
      { name: 'Europe-Central', lat: 52.5200, lon: 13.4050, country: 'DE' }, // Berlin
      { name: 'Europe-North', lat: 59.3293, lon: 18.0686, country: 'SE' }, // Stockholm
      { name: 'Europe-South', lat: 41.9028, lon: 12.4964, country: 'IT' }, // Rome
      { name: 'Europe-UK', lat: 51.5074, lon: -0.1278, country: 'GB' }, // London
      { name: 'North America', lat: 40.7128, lon: -74.0060, country: 'US' },
      { name: 'Asia-East', lat: 35.6762, lon: 139.6503, country: 'JP' },
      { name: 'Asia-South', lat: 28.6139, lon: 77.2090, country: 'IN' },
      { name: 'South America', lat: -23.5505, lon: -46.6333, country: 'BR' },
      { name: 'Africa-North', lat: 30.0444, lon: 31.2357, country: 'EG' }, // Cairo
      { name: 'Africa-West', lat: 6.5244, lon: 3.3792, country: 'NG' }, // Lagos
      { name: 'Africa-South', lat: -26.2041, lon: 28.0473, country: 'ZA' }, // Johannesburg
      { name: 'Oceania', lat: -33.8688, lon: 151.2093, country: 'AU' }
    ];

    for (const point of sweepPoints) {
      const issues: string[] = [];
      let successCount = 0;
      
      // Test Elevation
      try {
        const start = Date.now();
        const res = await getElevationData(point.lat, point.lon);
        if (res) successCount++; else issues.push('Elevation data missing');
        updateQualityStats('elevation', !!res, Date.now() - start, point.name);
      } catch (e) {
        issues.push('Elevation API timeout/error');
      }

      // Test Address (OSM Reverse Fallback)
      try {
        const start = Date.now();
        const res = await performOsmReverse(point.lat, point.lon, 'en', 18);
        if (res) successCount++; else issues.push('Address API (OSM) failed');
        updateQualityStats('address', !!res, Date.now() - start, point.name);
      } catch (e) {
        issues.push('Address API timeout/fail');
      }

      continentQuality[point.name] = {
        score: Math.round((successCount / 2) * 100),
        lastChecked: Date.now(),
        issues
      };
    }
    console.log('[Quality Monitor] Sweep Completed:', continentQuality);
  }

  // Schedule sweep every 24 hours (and once on startup)
  setInterval(runGlobalQualitySweep, 1000 * 60 * 60 * 24);
  setTimeout(runGlobalQualitySweep, 5000); // 5s after boot

  function updateQualityStats(type: string, success: boolean, duration: number, region: string = 'Global') {
    const stats = qualityStats[type] || { totalRequests: 0, successRequests: 0, failRequests: 0, avgResponseTime: 0, byRegion: {} };
    stats.totalRequests++;
    if (success) stats.successRequests++; else stats.failRequests++;
    
    // Update moving average
    stats.avgResponseTime = (stats.avgResponseTime * (stats.totalRequests - 1) + duration) / stats.totalRequests;

    if (!stats.byRegion[region]) {
      stats.byRegion[region] = { success: 0, fail: 0, avgTime: 0 };
    }
    const rStats = stats.byRegion[region];
    const rTotal = rStats.success + rStats.fail + 1;
    if (success) rStats.success++; else rStats.fail++;
    rStats.avgTime = (rStats.avgTime * (rTotal - 1) + duration) / rTotal;
    
    qualityStats[type] = stats;
  }

  /**
   * Safe fetch with timeout and error handling for all proxy routes
   * Includes internal retry for network-level failures
   */
  async function safeFetch(url: string, options: RequestInit = {}, timeoutMs = 60000, retries = 1): Promise<any> {
    // Basic cache check
    const cacheKey = `${url}-${JSON.stringify(options.body || '')}`;
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < API_CACHE_TTL) {
      return {
        ok: true,
        status: 200,
        json: async () => cached.data,
        text: async () => JSON.stringify(cached.data),
        headers: new Headers({ 
          'x-cache': 'HIT',
          'content-type': 'application/json'
        })
      } as any;
    }

    let lastError: any = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      // Merge headers carefully
      const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*'
      };
      
      if (options.headers) {
        Object.assign(headers, options.headers);
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const duration = Date.now() - start;
        
        // Track quality based on URL pattern
        let qType = 'other';
        if (url.includes('elevation') || url.includes('met-no')) qType = 'elevation';
        else if (url.includes('nominatim') || url.includes('address') || url.includes('zippopotam')) qType = 'address';
        else if (url.includes('overpass')) qType = 'overpass';
        
        updateQualityStats(qType, response.ok, duration);

        if (duration > 10000) {
          console.warn(`[API] Slow response (${duration}ms): ${url}`);
        }

        // Cache successful JSON responses in background
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const cloned = response.clone();
          cloned.json().then(data => {
            apiCache.set(cacheKey, { data, timestamp: Date.now() });
          }).catch(() => {});
        }
        
        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;
        const duration = Date.now() - start;
        
        const errorMsg = error?.message || String(error);
        const cause = error?.cause?.message || error?.cause?.code || error?.cause || '';
        const causeStr = cause.toString();
        const isDnsError = errorMsg.includes('getaddrinfo') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('EAI_AGAIN') || 
                          causeStr.includes('ENOTFOUND') || causeStr.includes('EAI_AGAIN') || causeStr.includes('EHOSTUNREACH') ||
                          causeStr.includes('ECONNREFUSED');
        const isNetworkError = isDnsError || errorMsg.includes('fetch failed') || error?.name === 'TypeError';
        
        // If it's a network/DNS error and we have retries left, wait a bit and try again
        // Longer wait for DNS errors (transient infrastructure issues)
        if (isNetworkError && attempt < retries) {
          const delay = isDnsError ? 1000 * (attempt + 1) : 300 * (attempt + 1);
          console.log(`[API] ${isDnsError ? 'DNS/Connect' : 'Network'} failure for ${url}, retrying in ${delay}ms... (Attempt ${attempt + 1}/${retries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        const fullError = cause ? `${errorMsg} (Cause: ${cause})` : errorMsg;
        const isMirrorUrl = url.includes('nominatim') || url.includes('overpass') || url.includes('photon');
        
        if (error?.name === 'AbortError') {
          console.error(`[API] Timeout after ${duration}ms: ${url}`);
        } else if (isMirrorUrl) {
          // Silent mirror failures as they are handled by higher-level retry/fallback logic
          // Only log debug info for mirror failures
          if (!isNetworkError) {
            console.debug(`[API] Mirror Fetch Error (${duration}ms): ${url} - ${fullError}`);
          }
        } else {
          console.error(`[API] Fetch Error for ${url}: ${fullError}`);
        }
        throw error;
      }
    }
    throw lastError;
  }

  // --- Nominatim Geocoding Mirrors ---
  const NOMINATIM_MIRRORS = [
    'https://nominatim.openstreetmap.org/reverse',      // Official
    'https://nominatim.openstreetmap.fr/reverse',       // France
    'https://nominatim.osm.ch/reverse',                 // Switzerland
    'https://nominatim.openstreetmap.de/reverse',       // Germany
    'https://nominatim.openstreetmap.be/reverse',       // Belgium
    'https://nominatim.openstreetmap.ie/reverse',       // Ireland
    'https://nominatim.openstreetmap.org.tr/reverse',    // Turkey
    'https://photon.komoot.io/reverse',                 // Photon (Fallback)
  ];

  const nominatimBlacklist = new Map<string, number>();
  const NOMINATIM_BLACKLIST_DURATION = 1000 * 60 * 30; // 30 mins
  /**
   * Ultimate fallback using Gemini AI for reverse geocoding
   */
  async function performGeminiReverseGeocode(lat: number, lon: number, lang: string = 'en') {
    try {
      const prompt = `Reverse geocode these coordinates: latitude ${lat}, longitude ${lon}.
Return a JSON object ONLY with the following structure: 
{ 
  "place_id": 0, 
  "display_name": "Full address string, e.g., Tokyo Station, Marunouchi, Chiyoda City, Tokyo 100-0005, Japan", 
  "address": { 
    "road": "Street/Place name", 
    "city": "City/Sub-area", 
    "state": "Prefecture/State", 
    "postcode": "Postcode", 
    "country": "Country", 
    "country_code": "2-letter country code" 
  } 
}. 
The primary language for address names should matches ${lang}. Use empty strings for missing fields. Output ONLY valid JSON.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (text) {
        const data = JSON.parse(text);
        return {
          ...data,
          place_id: Math.floor(Math.random() * 1000000),
          licence: "Gemini AI Reverse Geocoding",
          osm_type: "node",
          osm_id: 0,
          lat: lat.toString(),
          lon: lon.toString()
        };
      }
    } catch (e) {
      // Silent failure for Gemini fallback
    }
    return null;
  }

  /**
   * Search fallback using Gemini AI
   */
  async function performGeminiSearch(q: string, lang: string = 'en', limit: number = 5) {
    try {
      const prompt = `Geocode the following search query: "${q}". 
Return a JSON array of objects (max ${limit}) with the following structure: 
[
  { 
    "place_id": 0, 
    "display_name": "Full address string", 
    "lat": "latitude as string", 
    "lon": "longitude as string", 
    "type": "place type (e.g., city, street, poi)",
    "address": { 
      "road": "Street/Place name", 
      "city": "City", 
      "state": "Province/State", 
      "postcode": "Postcode", 
      "country": "Country", 
      "country_code": "2-letter CC" 
    } 
  }
]. 
Primary language: ${lang}. Output ONLY valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (text) {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          return data.map((item: any) => ({
            ...item,
            place_id: item.place_id || Math.floor(Math.random() * 1000000),
            licence: "Gemini AI Geocoding Search",
            osm_type: "node",
            osm_id: 0
          }));
        }
      }
    } catch (e) {
      // Silent failure
    }
    return [];
  }

  /**
   * Robust reverse geocoding using multiple mirrors
   */
  async function performOsmReverse(lat: number, lon: number, lang: string = 'en', zoom: number = 18, countryCode?: string) {
    const now = Date.now();
    let mirrors = NOMINATIM_MIRRORS.filter(m => {
      const until = nominatimBlacklist.get(m);
      return !until || now > until;
    });

    if (mirrors.length === 0) {
      nominatimBlacklist.clear();
      mirrors = [...NOMINATIM_MIRRORS];
    }

    // Sort mirrors with prioritization
    mirrors.sort((a, b) => {
      const aOfficial = a.includes('openstreetmap.org/reverse');
      const bOfficial = b.includes('openstreetmap.org/reverse');
      const aPhoton = a.includes('photon');
      const bPhoton = b.includes('photon');

      // 1. Prioritize Country-specific mirror if CC is provided
      if (countryCode) {
        const cc = countryCode.toLowerCase();
        const aMatch = a.includes(`.${cc}/`) || a.includes(`.${cc}.`);
        const bMatch = b.includes(`.${cc}/`) || b.includes(`.${cc}.`);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      
      // 2. Official mirror is usually best but heavily rate limited
      if (aOfficial && !bOfficial) return -1;
      if (!aOfficial && bOfficial) return 1;
      
      // 3. Photon is a fallback search engine, keep it last
      if (aPhoton && !bPhoton) return 1;
      if (!aPhoton && bPhoton) return -1;
      
      // 4. Randomize the middle regional mirrors to distribute load
      return Math.random() - 0.5;
    });

    const errors: string[] = [];
    for (const mirror of mirrors) {
      try {
        const isPhoton = mirror.includes('photon');
        const url = isPhoton 
          ? `${mirror}?lat=${lat}&lon=${lon}`
          : `${mirror}?format=json&lat=${lat}&lon=${lon}&addressdetails=1&zoom=${zoom}&accept-language=${lang}`;

        // Add User-Agent and identifying headers
        const res = await safeFetch(url, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (compatible; AGID-Geogrid-Explorer/2.5.1; +https://github.com/kitauracode/geogrid-explorer)',
            'Accept-Language': lang
          }
        }, isPhoton ? 10000 : 15000);
        
        const contentType = res.headers.get('content-type') || '';
        
        // Accept common JSON/GeoJSON content types
        if (res.ok && (contentType.includes('json') || contentType.includes('geojson'))) {
          const text = await res.text();
          
          // Verify it's actually JSON and not HTML or plain text error
          const trimmed = text.trim();
          if (trimmed.startsWith('<!DOCTYPE html>') || trimmed.startsWith('<html') || !trimmed.startsWith('{')) {
             nominatimBlacklist.set(mirror, now + NOMINATIM_BLACKLIST_DURATION);
             errors.push(`${mirror} (Returned invalid format: ${trimmed.substring(0, 20)}...)`);
             continue;
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (jsonErr) {
            nominatimBlacklist.set(mirror, now + NOMINATIM_BLACKLIST_DURATION);
            errors.push(`${mirror} (JSON parse error)`);
            continue;
          }

          if (isPhoton) {
            if (data.features?.length > 0) {
              const feat = data.features[0];
              const p = feat.properties;
              return {
                place_id: Math.floor(Math.random() * 1000000),
                display_name: p.name ? `${p.name}, ${p.city || ''}, ${p.country || ''}` : (p.city || 'Unknown point'),
                address: {
                  road: p.street || p.name,
                  city: p.city,
                  state: p.state,
                  postcode: p.postcode,
                  country: p.country,
                  country_code: p.countrycode?.toLowerCase()
                }
              };
            }
            continue; 
          }
          return data;
        } else {
          // If not OK or not JSON, blacklist
          const isRateLimit = res.status === 429;
          const isServerError = res.status >= 500;
          const isNotFound = res.status === 404;
          const isNotJson = res.ok && !(contentType.includes('json') || contentType.includes('geojson'));
          
          if (isRateLimit || isServerError || isNotJson || isNotFound) {
            nominatimBlacklist.set(mirror, now + NOMINATIM_BLACKLIST_DURATION);
          }
          errors.push(`${mirror} (${res.status}${isNotJson ? ' Non-JSON' : ''})`);
        }
      } catch (e: any) {
        // Blacklist on DNS/Network failure
        const msg = e.message || String(e);
        const cause = e?.cause?.message || e?.cause?.code || e?.cause || '';
        const causeStr = cause.toString();
        const isDnsError = msg.includes('getaddrinfo') || msg.includes('ENOTFOUND') || msg.includes('EAI_AGAIN') || 
                           causeStr.includes('ENOTFOUND') || causeStr.includes('EAI_AGAIN') || 
                           causeStr.includes('EHOSTUNREACH') || causeStr.includes('ECONNREFUSED');
        const isNetworkError = isDnsError || msg.includes('fetch failed') || msg.includes('timeout') || msg.includes('aborted');
        
        // Use 2 hours for DNS/Host issues, 60 seconds for other transient network issues
        const blacklistDuration = isDnsError ? 1000 * 60 * 120 : (isNetworkError ? 60000 : NOMINATIM_BLACKLIST_DURATION);
        nominatimBlacklist.set(mirror, now + blacklistDuration);
        errors.push(`${mirror} [${msg}]`);
        
        // Silent mirror failures
        if (!isNetworkError && !msg.includes('429')) {
          console.debug(`[API] Reverse Mirror Failed: ${mirror} - ${msg}`);
        }
      }
    }
    
    // AI Fallback before returning coordinate label
    const geminiResult = await performGeminiReverseGeocode(lat, lon, lang);
    if (geminiResult) {
      console.log(`[API] Mirror failure at ${lat}, ${lon}. Recovered via Gemini AI.`);
      return geminiResult;
    }

    // Fallback instead of throwing: return coordinate-based label if all mirrors fail
    console.warn(`[API] All geocoding mirrors failed for ${lat}, ${lon}. Using coordinate fallback.`);
    return {
      place_id: 0,
      display_name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      address: {
        country: 'Unknown',
        country_code: '??'
      },
      fallback: true
    };
  }

  // Elevation Cache (Small in-memory cache)
  const elevationCache = new Map<string, { val: number, timestamp: number }>();
  const ELEVATION_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
  const elevationMirrorBlacklist = new Map<string, number>();
  const ELEVATION_BLACKLIST_DURATION = 1000 * 60 * 15; // 15 mins

  /**
   * Internal helper for robust elevation lookup with multiple fallbacks
   */
  async function getElevationData(lat: number, lon: number): Promise<{ elevation: number, source: string } | null> {
    const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    const cached = elevationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < ELEVATION_CACHE_TTL)) {
      return { elevation: cached.val, source: 'cache' };
    }

    const now = Date.now();

    // Try multiple sources in order of reliability
    const sources = [
      { 
        name: 'open-meteo-europe',
        url: `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,
        timeout: 10000,
        parser: (data: any) => data?.elevation?.[0],
        regionBias: 'EU'
      },
      { 
        name: 'opentopodata-srtm30m', 
        url: `https://api.opentopodata.org/v1/srtm30m?locations=${lat},${lon}`,
        timeout: 15000,
        parser: (data: any) => data?.results?.[0]?.elevation,
        regionBias: 'Global'
      },
      { 
        name: 'met-no-nordics', 
        url: `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
        timeout: 12000,
        parser: (data: any) => data?.properties?.timeseries?.[0]?.data?.instant?.details?.altitude,
        regionBias: 'Nordics'
      },
      {
        name: 'open-elevation',
        url: `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`,
        timeout: 5000,
        parser: (data: any) => data?.results?.[0]?.elevation,
        regionBias: 'Global-Low-Res'
      }
    ];

    for (const source of sources) {
      // Check blacklist
      const blacklistUntil = elevationMirrorBlacklist.get(source.name);
      if (blacklistUntil && now < blacklistUntil) continue;

      try {
        const res = await safeFetch(source.url, {}, source.timeout);
        if (res.ok) {
          const data = await res.json();
          const elev = source.parser(data);
          if (typeof elev === 'number') {
            elevationCache.set(cacheKey, { val: elev, timestamp: Date.now() });
            // Clean up cache if too large
            if (elevationCache.size > 5000) {
              const firstKey = elevationCache.keys().next().value;
              if (firstKey) elevationCache.delete(firstKey);
            }
            return { elevation: elev, source: source.name };
          }
        } else {
          // Blacklist on HTTP error
          elevationMirrorBlacklist.set(source.name, now + ELEVATION_BLACKLIST_DURATION);
        }
      } catch (e: any) {
        // Blacklist on timeout/network error
        elevationMirrorBlacklist.set(source.name, now + ELEVATION_BLACKLIST_DURATION);
        
        const isAbort = e instanceof Error && (e.name === 'AbortError' || e.message?.includes('aborted'));
        if (!isAbort) {
          console.warn(`[Elevation Proxy] Source ${source.name} failed (blacklisted for 15m):`, e.message || e);
        }
      }
    }

    return null;
  }

  // Elevation API Integration
  app.get('/api/elevation', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const data = await getElevationData(lat, lon);
      if (data) {
        return res.json(data);
      }
      res.status(404).json({ error: 'Elevation data not found' });
    } catch (error) {
      console.error('Elevation API Route Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Overpass API Proxy with Mirror Support ---
  const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',          // Germany (Main)
    'https://overpass.osm.ch/api/interpreter',          // Switzerland
    'https://overpass.osm.viarezo.fr/api/interpreter',  // France
    'https://lz4.overpass-api.de/api/interpreter',      // Germany (Mirror 2)
    'https://z.overpass-api.de/api/interpreter',       // Germany (Mirror 3)
    'https://overpass.kumi.systems/api/interpreter',    // Kumi (Global)
    'https://overpass.osmosur.org/api/interpreter',     // South America
    'https://overpass.nchc.org.tw/api/interpreter',     // Taiwan
    'https://overpass.be/api/interpreter',              // Belgium
  ];

  const mirrorBlacklist = new Map<string, number>();
  const BLACKLIST_DURATION_RATE_LIMIT = 1000 * 60 * 10; // 10 min
  const BLACKLIST_DURATION_ERROR = 1000 * 60 * 15; // 15 min
  const BLACKLIST_DURATION_TIMEOUT = 1000 * 20; // 20s for transient timeouts
  const BLACKLIST_DURATION_406 = 1000 * 60 * 60 * 2; // 2 hours
  const BLACKLIST_DURATION_DNS = 1000 * 60 * 60 * 4; // 4 hours

  const overpassCache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 1000 * 60 * 60 * 24;

  async function fetchFromOverpass(query: string) {
    const cacheKey = query.trim();
    const now = Date.now();
    
    // 1. Check Cache
    const cached = overpassCache.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL)) return cached.data;

    // 2. Prepare Mirrors
    let mirrorsToTry = OVERPASS_MIRRORS.filter(m => {
      const until = mirrorBlacklist.get(m);
      return !until || now > until;
    });

    if (mirrorsToTry.length < 3) {
      mirrorBlacklist.clear();
      mirrorsToTry = [...OVERPASS_MIRRORS];
    }

    // Dynamic prioritization
    mirrorsToTry.sort((a, b) => {
      // Tier 1: Swiss & France (Highly Reliable)
      const t1 = ['osm.ch', 'viarezo.fr', 'overpass-api.de'];
      const aT1 = t1.some(p => a.includes(p));
      const bT1 = t1.some(p => b.includes(p));
      if (aT1 && !bT1) return -1;
      if (!aT1 && bT1) return 1;

      // Tier 2: Kumi
      const t2 = ['kumi.systems'];
      const aT2 = t2.some(p => a.includes(p));
      const bT2 = t2.some(p => b.includes(p));
      if (aT2 && !bT2) return -1;
      if (!aT2 && bT2) return 1;

      return Math.random() - 0.5;
    });

    const errors: string[] = [];
    const maxAttempts = Math.min(mirrorsToTry.length, 6); // Reduced from 12 to 6 to prevent frontend timeouts
    
    for (let i = 0; i < maxAttempts; i++) {
      const mirror = mirrorsToTry[i];
      try {
        const controller = new AbortController();
        // Individual mirror timeout reduced to failover faster
        const timeoutDuration = i < 2 ? 15000 : 10000; 
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        const response = await fetch(mirror, {
          method: 'POST',
          body: new URLSearchParams({ data: query }).toString(),
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (compatible; AGID-Geogrid-Explorer/2.5.1; +https://github.com/kitauracode/geogrid-explorer)'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const text = await response.text();
          if (!text || text.trim().startsWith('<!DOCTYPE html>')) {
            throw new Error('Received HTML instead of JSON');
          }
          
          try {
            const data = JSON.parse(text);
            if (data.remark && (data.remark.includes('runtime error') || data.remark.includes('timed out'))) {
              throw new Error(`Overpass Remark: ${data.remark}`);
            }
            overpassCache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
          } catch (jsonErr) {
            throw new Error('Invalid JSON');
          }
        }
        
        if (response.status === 429) {
          mirrorBlacklist.set(mirror, Date.now() + BLACKLIST_DURATION_RATE_LIMIT);
          console.debug(`[Overpass] Mirror ${mirror} rate limited (429)`);
        } else if (response.status === 406) {
          mirrorBlacklist.set(mirror, Date.now() + BLACKLIST_DURATION_406);
          console.debug(`[Overpass] Mirror ${mirror} returned 406 (Blacklisted)`);
        } else {
          mirrorBlacklist.set(mirror, Date.now() + BLACKLIST_DURATION_ERROR);
          console.debug(`[Overpass] Mirror ${mirror} failed with HTTP ${response.status}`);
        }
        errors.push(`${mirror}: HTTP ${response.status}`);
      } catch (e: any) {
        const msg = e.message || String(e);
        const cause = e?.cause?.message || e?.cause?.code || e?.cause || '';
        const causeStr = cause.toString();
        
        const isDnsError = msg.includes('getaddrinfo') || msg.includes('ENOTFOUND') || msg.includes('EAI_AGAIN') || 
                          causeStr.includes('ENOTFOUND') || causeStr.includes('EAI_AGAIN') || 
                          causeStr.includes('EHOSTUNREACH') || causeStr.includes('ECONNREFUSED');
        const isTimeout = e.name === 'AbortError' || msg.includes('timeout') || causeStr.includes('timeout');
        
        const blacklistDuration = isDnsError ? BLACKLIST_DURATION_DNS : (isTimeout ? BLACKLIST_DURATION_TIMEOUT : BLACKLIST_DURATION_ERROR);
        mirrorBlacklist.set(mirror, Date.now() + blacklistDuration);
        
        const errorDetail = isTimeout ? 'Timeout' : (isDnsError ? 'DNS/Connect Failure' : msg);
        console.debug(`[Overpass] Mirror failure for ${mirror}: ${errorDetail}`);
        errors.push(`${mirror}: ${errorDetail}`);
      }
    }

    console.warn(`[Overpass] All mirrors failed. Returning empty OSM structure.`);
    return {
      version: 0.6,
      generator: "Overpass API Fallback (Server)",
      osm3s: { timestamp_osm_base: new Date().toISOString() },
      elements: []
    };
  }

  /**
   * Emergency Fallback to Nominatim when Overpass is dead
   */
  async function fetchLandmarksFallback(lat: number, lon: number) {
    try {
      console.log(`[Proxy Fallback] Attempting Nominatim fallback for landmarks...`);
      // Search for points of interest nearby using Nominatim search
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=landmark+near+${lat},${lon}&limit=10&addressdetails=1`;
      const res = await safeFetch(url);
      if (res.ok) {
        const data = await res.json();
        return {
          elements: data.map((item: any) => ({
            type: 'node',
            id: parseInt(item.place_id),
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            tags: {
              name: item.display_name.split(',')[0],
              historic: 'yes',
              landmark: 'yes'
            }
          }))
        };
      }
    } catch (e) {
      console.error('[Proxy Fallback] Nominatim fallback failed:', e);
    }
    return { elements: [] };
  }

  // --- Marine Regions Proxy ---
  async function fetchMarineRegionsWithFallback(lat: number, lon: number) {
    const trySources = [
      // 1. Primary: Marine Regions REST API
      async () => {
        const url = `https://www.marineregions.org/rest/getGazetteerRecordsByLatLong.json/${lat}/${lon}/0.5/0.5/`;
        const response = await safeFetch(url, {}, 25000);
        if (response.ok) return await response.json();
        throw new Error(`MarineRegions failed with ${response.status}`);
      },
      // 2. Secondary: http alternative (sometimes avoids SSL issues in containers)
      async () => {
        const url = `http://www.marineregions.org/rest/getGazetteerRecordsByLatLong.json/${lat}/${lon}/0.5/0.5/`;
        const response = await safeFetch(url, {}, 25000);
        if (response.ok) return await response.json();
        throw new Error(`MarineRegions HTTP failed with ${response.status}`);
      },
      // 3. Fallback: Nominatim reverse with zoom to find water body names
      async () => {
        console.log('[Marine Proxy] Falling back to Nominatim for sea name');
        try {
          const data = await performOsmReverse(lat, lon, 'en', 5);
          if (data) {
            const addr = data.address || {};
            const seaName = addr.sea || addr.ocean || addr.bay || addr.gulf || addr.strait || addr.water;
            if (seaName) {
              return [{
                preferredGazetteerName: seaName,
                placeType: addr.ocean ? 'Ocean' : 'Sea'
              }];
            }
          }
        } catch (err) {
          console.warn('[Marine Proxy] Nominatim fallback failed:', err);
        }
        throw new Error('Nominatim sea fallback failed');
      }
    ];

    for (const source of trySources) {
      try {
        const data = await source();
        if (data) return data;
      } catch (e: any) {
        // Only log serious failures, ignore aborts during fallback attempts to keep logs clean
        const isAbort = e instanceof Error && (e.name === 'AbortError' || e.message?.includes('aborted'));
        if (!isAbort) {
          console.warn(`[Marine Proxy] Source failed:`, e instanceof Error ? e.message : e);
        }
      }
    }
    return [];
  }

  app.get('/api/overpass', (req, res) => {
    res.json({ message: 'Overpass proxy is active. Use POST to query.' });
  });

  // Using a more flexible body parser for Overpass
  app.post('/api/overpass', async (req, res) => {
    try {
      let query = '';
      
      // Handle both JSON and text bodies
      if (req.headers['content-type']?.includes('application/json')) {
        query = req.body?.query;
      } else if (typeof req.body === 'string') {
        query = req.body;
      } else if (req.body && typeof req.body === 'object' && req.body.query) {
        query = req.body.query;
      }

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Invalid query body' });
      }

      try {
        const data = await fetchFromOverpass(query);
        res.json(data);
      } catch (overpassError) {
        console.error('[API] Overpass Proxy Critical Failure:', overpassError);
        
        // Try fallback if coordinates can be extracted from query
        const match = query.match(/around:(\d+),([-.\d]+),([-.\d]+)/);
        if (match) {
          const lat = parseFloat(match[2]);
          const lon = parseFloat(match[3]);
          const fallbackData = await fetchLandmarksFallback(lat, lon);
          return res.json(fallbackData);
        }
        
        const isQuota = overpassError instanceof Error && (overpassError.message.includes('Rate limited') || overpassError.message === 'Recently failed query');
        const errorMsg = overpassError instanceof Error ? overpassError.message : 'Overpass proxy failed';
        
        // Ensure we always return JSON
        res.setHeader('Content-Type', 'application/json');
        res.status(isQuota ? 429 : 503).send(JSON.stringify({ error: errorMsg }));
      }
    } catch (error) {
      console.error('[API] Overpass Route Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GEBCO WMS Proxy (General Bathymetric Chart of the Oceans)
  app.get('/api/gebco', async (req, res) => {
    const queryParams = new URLSearchParams(req.query as any).toString();
    const gebcoUrl = `https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv?${queryParams}`;

    try {
      const response = await safeFetch(gebcoUrl);

      if (!response.ok) {
        return res.status(response.status).send('GEBCO fetch failed');
      }

      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error('GEBCO Proxy Error:', error);
      res.status(500).send('GEBCO Proxy Internal Error');
    }
  });

  // Brazil ViaCEP Proxy (Free, No Key)
  app.get('/api/br-viacep/:cep', async (req, res) => {
    const { cep } = req.params;
    try {
      const response = await safeFetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'CEP not found' });
    } catch (error) {
      console.error('ViaCEP API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // India Postal Pincode Proxy (Free, No Key)
  app.get('/api/in-pincode/:pincode', async (req, res) => {
    const { pincode } = req.params;
    try {
      const response = await safeFetch(`https://api.postalpincode.in/pincode/${pincode}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Pincode not found' });
    } catch (error) {
      console.error('Pincode API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Zippopotam.us Proxy (Free, No Key)
  app.get('/api/zippopotam/:country/:postcode', async (req, res) => {
    const { country, postcode } = req.params;
    try {
      const response = await safeFetch(`https://api.zippopotam.us/${country}/${postcode}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Postcode not found' });
    } catch (error) {
      console.error('Zippopotam API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Hong Kong OGCIO Address Lookup Service (Free, Public)
  // Essential for HK which has no postal codes
  app.get('/api/hk-als/lookup', async (req, res) => {
    const { q, lat, lon } = req.query;
    try {
      let url = 'https://www.als.ogcio.gov.hk/lookup';
      if (q) {
        url += `?q=${encodeURIComponent(q as string)}`;
      } else if (lat && lon) {
        url += `?lat=${lat}&long=${lon}`;
      } else {
        return res.status(400).json({ error: 'Missing q or lat/lon' });
      }

      const response = await safeFetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'HK ALS lookup failed' });
    } catch (error) {
      console.error('HK ALS Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Global Plus Code (Open Location Code) API
  // Universal addressing system for countries without postal codes
  app.get('/api/plusmode/:action', async (req, res) => {
    const { action } = req.params;
    const { lat, lon, code } = req.query;
    
    try {
      const { OpenLocationCode } = await import('open-location-code');
      const olc = new OpenLocationCode();

      if (action === 'encode') {
        if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });
        const plusCode = olc.encode(parseFloat(lat as string), parseFloat(lon as string));
        return res.json({ plusCode });
      } else if (action === 'decode') {
        if (!code) return res.status(400).json({ error: 'Missing code' });
        const area = olc.decode(code as string);
        return res.json(area);
      }
      res.status(404).json({ error: 'Action not found' });
    } catch (error) {
      console.error('PlusCode API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // UK Postcodes.io Proxy (Free, Open Data)
  app.get('/api/uk-postcode/:postcode', async (req, res) => {
    const { postcode } = req.params;
    try {
      const response = await safeFetch(`https://api.postcodes.io/postcodes/${postcode}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Postcode not found' });
    } catch (error) {
      console.error('Postcodes.io API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Nordic Met.no API Proxy (Free, Open Data - Norwegian Meteorological Institute)
  // Provides high-quality weather data for the Nordic region
  app.get('/api/nordic/weather', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const response = await safeFetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`);

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Weather data not found' });
    } catch (error) {
      console.error('Met.no API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // France Base Adresse Nationale (BAN) API Proxy (Free, Open Data)
  app.get('/api/fr-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const response = await safeFetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'French address not found' });
    } catch (error) {
      console.error('France BAN API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Netherlands PDOK Locatieserver API Proxy (Free, Open Data)
  app.get('/api/nl-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const response = await safeFetch(`https://api.pdok.nl/bzk/locatieserver/v3_1/reverse?lat=${lat}&lon=${lon}&type=adres&fl=id,weergavenaam,postcode,huisnummer,straatnaam,woonplaatsnaam`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Dutch address not found' });
    } catch (error) {
      console.error('Netherlands PDOK API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Denmark DAWA API Proxy (Free, Open Data - Danmarks Adressers Web API)
  app.get('/api/dk-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const response = await safeFetch(`https://dawa.aws.dk/adgangsadresser/reverse?x=${lon}&y=${lat}&format=json`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Danish address not found' });
    } catch (error) {
      console.error('Denmark DAWA API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Norway Kartverket API Proxy (Free, Open Data - Norwegian Mapping Authority)
  app.get('/api/no-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const response = await safeFetch(`https://ws.geonorge.no/adresser/v1/punktsok?lat=${lat}&lon=${lon}&radius=50`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Norwegian address not found' });
    } catch (error) {
      console.error('Norway Kartverket API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Finland Digitransit Geocoding API Proxy (Free, Open Data)
  app.get('/api/fi-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const response = await safeFetch(`https://api.digitransit.fi/geocoding/v1/reverse?point.lat=${lat}&point.lon=${lon}&size=1`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Finnish address not found' });
    } catch (error) {
      console.error('Finland Digitransit API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Germany Nominatim Proxy
  app.get('/api/de-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'de', 18, 'de');
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'German address not found' });
    }
  });

  // Belgium (Brussels/Flanders/Wallonia) - Using regional Open Data proxies
  app.get('/api/be-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'nl,fr,de', 18, 'be');
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Belgian address not found' });
    }
  });

  // Switzerland swisstopo API Proxy (Free, Open Data)
  app.get('/api/ch-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=${lon},${lat}&imageDisplay=0,0,0&mapExtent=0,0,0,0&tolerance=50&layers=all:ch.bfs.gebaeude_wohnungs_register&returnGeometry=false`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Swiss address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Austria BEV (Bundesamt für Eich- und Vermessungswesen) Proxy
  app.get('/api/at-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'de-AT', 18, 'at');
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Austrian address not found' });
    }
  });

  // Sweden Lantmäteriet Proxy
  app.get('/api/se-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'sv', 18, 'se');
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Swedish address not found' });
    }
  });

  // Estonia Maa-amet (Land Board) Proxy
  app.get('/api/ee-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'et', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Estonian address not found' });
    }
  });

  // Latvia LĢIA (Latvian Geospatial Information Agency) Proxy
  app.get('/api/lv-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'lv', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Latvian address not found' });
    }
  });

  // Lithuania Registrų centras Proxy
  app.get('/api/lt-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'lt', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Lithuanian address not found' });
    }
  });

  // Iceland Landmælingar Íslands (National Land Survey of Iceland) Proxy
  app.get('/api/is-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'is', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Icelandic address not found' });
    }
  });

  // Italy Proxy
  app.get('/api/it-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'it', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Italian address not found' });
    }
  });

  // Spain CartoCiudad API Proxy (Free, Open Data - Instituto Geográfico Nacional)
  app.get('/api/es-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const response = await safeFetch(`https://www.cartociudad.es/CartoCiudad-webservices/api/reverGeocoding/getAddres?lat=${lat}&lon=${lon}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      // Fallback
      const data = await performOsmReverse(lat, lon, 'es', 18);
      return res.json(data);
    } catch (error: any) {
      console.error('Spain CartoCiudad API Error:', error);
      res.status(502).json({ error: error.message || 'Spanish address not found' });
    }
  });

  // Portugal Proxy
  app.get('/api/pt-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'pt', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Portuguese address not found' });
    }
  });

  // Greece Proxy
  app.get('/api/gr-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'el', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Greek address not found' });
    }
  });

  // Malta Proxy
  app.get('/api/mt-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'mt,en', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Maltese address not found' });
    }
  });

  // Cyprus Proxy
  app.get('/api/cy-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const data = await performOsmReverse(lat, lon, 'el,tr,en', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Cypriot address not found' });
    }
  });

  // Microstates (Monaco, San Marino, Vatican, Andorra)
  app.get('/api/microstate-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const cc = req.query.cc as string;
    let lang = 'en';
    if (cc === 'mc') lang = 'fr';
    if (cc === 'sm' || cc === 'va') lang = 'it';
    if (cc === 'ad') lang = 'ca,es,fr';

    try {
      const data = await performOsmReverse(lat, lon, lang, 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Microstate address not found' });
    }
  });

  // Eastern Europe & Balkans Proxy
  app.get('/api/ee-balkan-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const cc = req.query.cc as string;
    
    let lang = 'en';
    switch(cc) {
      case 'ro': lang = 'ro'; break;
      case 'bg': lang = 'bg'; break;
      case 'ua': lang = 'uk'; break;
      case 'md': lang = 'ro,ru'; break;
      case 'by': lang = 'be,ru'; break;
      case 'ru': lang = 'ru'; break;
      case 'rs': lang = 'sr'; break;
      case 'ba': lang = 'bs,hr,sr'; break;
      case 'me': lang = 'sr,sq'; break;
      case 'xk': lang = 'sq,sr'; break;
      case 'al': lang = 'sq'; break;
      case 'mk': lang = 'mk'; break;
      case 'pl': lang = 'pl'; break;
      case 'cz': lang = 'cs'; break;
      case 'sk': lang = 'sk'; break;
      case 'hu': lang = 'hu'; break;
      case 'si': lang = 'sl'; break;
      case 'hr': lang = 'hr'; break;
      case 'am': lang = 'hy,ru'; break;
      case 'az': lang = 'az,ru'; break;
      case 'ge': lang = 'ka,ru'; break;
    }

    try {
      const data = await performOsmReverse(lat, lon, lang, 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || `Address not found for ${cc}` });
    }
  });

  // UK Ordnance Survey / Postcode Focused Proxy
  app.get('/api/uk-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Invalid coordinates' });

    try {
      const data = await performOsmReverse(lat, lon, 'en-GB', 18);
      res.json(data);
    } catch (error: any) {
      console.error('UK API Error:', error);
      res.status(502).json({ error: error.message || 'UK address not found' });
    }
  });

  // Germany BKG-style Proxy (Bund - Open Data focus)
  app.get('/api/de-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Invalid coordinates' });

    try {
      const data = await performOsmReverse(lat, lon, 'de', 18);
      res.json(data);
    } catch (error: any) {
      console.error('Germany API Error:', error);
      res.status(502).json({ error: error.message || 'German address not found' });
    }
  });

  // Italy ISTAT Region Focused Proxy
  app.get('/api/it-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Invalid coordinates' });

    try {
      const data = await performOsmReverse(lat, lon, 'it', 18);
      res.json(data);
    } catch (error: any) {
      console.error('Italy API Error:', error);
      res.status(502).json({ error: error.message || 'Italian address not found' });
    }
  });

  // Ireland GeoHive API Proxy (OSi - Ordnance Survey Ireland)
  app.get('/api/ie-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const data = await performOsmReverse(lat, lon, 'en,ga', 18);
      res.json(data);
    } catch (error: any) {
      console.error('Ireland API Error:', error);
      res.status(502).json({ error: error.message || 'Irish address not found' });
    }
  });

  // Luxembourg Geoportail API Proxy
  app.get('/api/lu-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const data = await performOsmReverse(lat, lon, 'lb,fr,de', 18);
      res.json(data);
    } catch (error: any) {
      console.error('Luxembourg API Error:', error);
      res.status(502).json({ error: error.message || 'Luxembourg address not found' });
    }
  });

  // South Africa Address Proxy (OSM Focus)
  app.get('/api/za-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Invalid coordinates' });
    try {
      const data = await performOsmReverse(lat, lon, 'en,af,zu,xh', 18);
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'South African address not found' });
    }
  });

  // Egypt Address Proxy (Multilingual Arabic/English)
  app.get('/api/eg-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Invalid coordinates' });
    try {
      const data = await performOsmReverse(lat, lon, 'ar,en', 18, 'eg');
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Egyptian address not found' });
    }
  });

  // Japan Postcode Proxy (zipcloud - Open Data)
  app.get('/api/jp-postcode', async (req, res) => {
    const zipcode = req.query.zipcode as string;
    try {
      const response = await safeFetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Japan postcode not found' });
    } catch (error) {
      console.error('[API] Japan Postcode Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Tianditu (China) Proxy
  app.get('/api/tianditu-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const url = `https://api.tianditu.gov.cn/geocoder?postStr={'lon':${lon},'lat':${lat},'ver':1}&type=geocode&tk=${process.env.TIANDITU_TOKEN || '70868a86707379768a8670737976'}`;
    
    try {
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Tianditu address not found' });
    } catch (error) {
      console.error('[API] Tianditu Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Nominatim Proxy ---
  app.get('/api/nominatim/reverse', async (req, res) => {
    const { lat, lon, zoom, addressdetails, lang, cc } = req.query;
    try {
      const l = parseFloat(lat as string);
      const n = parseFloat(lon as string);
      const z = zoom ? parseInt(zoom as string) : 18;
      const ln = lang ? (lang as string) : 'en';
      const countryCode = cc ? (cc as string) : undefined;

      const data = await performOsmReverse(l, n, ln, z, countryCode);
      res.json(data);
    } catch (error: any) {
      console.error('[API] Nominatim Reverse Error:', error);
      res.status(500).json({ error: error.message || 'Nominatim reverse geocode failed' });
    }
  });

  app.get('/api/nominatim/search', async (req, res) => {
    const { q, countrycodes, limit, lang, addressdetails } = req.query;
    try {
      const data = await performOsmSearch(q as string, {
        countrycodes: countrycodes as string,
        limit: limit ? parseInt(limit as string) : 10,
        accept_language: lang ? (lang as string) : 'en',
        addressdetails: addressdetails ? parseInt(addressdetails as string) : 1
      });
      res.json(data);
    } catch (error: any) {
      console.error('[API] Nominatim Search Error:', error);
      res.status(500).json({ error: error.message || 'Nominatim search failed' });
    }
  });

  // --- OSRM Routing Proxy ---
  app.get('/api/osrm/route', async (req, res) => {
    const { start, end } = req.query;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=geojson`;
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'OSRM routing failed' });
    } catch (error) {
      console.error('[API] OSRM Route Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Chromium i18n Address Metadata Proxy ---
  app.get('/api/address-metadata', async (req, res) => {
    const { path } = req.query;
    try {
      const url = `https://chromium-i18n.appspot.com/ssl-address/data/${path}`;
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Address metadata fetch failed' });
    } catch (error) {
      console.error('[API] Address Metadata Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Photon (Komoot) Search Proxy ---
  app.get('/api/photon', async (req, res) => {
    const { q, limit, lat, lon } = req.query;
    try {
      let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q as string)}&limit=${limit || 5}`;
      if (lat && lon) {
        url += `&lat=${lat}&lon=${lon}`;
      }
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Photon search failed' });
    } catch (error) {
      console.error('[API] Photon Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Canada Proxy
  app.get('/api/ca-statcan-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const fallbackUrl = `https://geogratis.gc.ca/services/geolocation/en/locate?lat=${lat}&lon=${lon}`;
    
    try {
      const response = await safeFetch(fallbackUrl);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Canada address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mexico INEGI Proxy
  app.get('/api/mx-inegi-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const url = `https://www.inegi.org.mx/app/api/denue/v1/consulta/buscar/${lat},${lon}/100/${process.env.INEGI_TOKEN || 'token'}`;
    
    try {
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      // Fallback to OpenStreetMap Mexico specialized endpoint if available
      res.status(response.status).json({ error: 'Mexico address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Brazil IBGE Proxy
  app.get('/api/br-ibge-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/distritos?lat=${lat}&lon=${lon}`;
    
    try {
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Brazil address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Zippopotam.us Proxy
  app.get('/api/zippopotam-postcode', async (req, res) => {
    const cc = req.query.cc as string;
    const pc = req.query.pc as string;
    try {
      const response = await safeFetch(`https://api.zippopotam.us/${cc}/${pc}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Postcode not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Belgium BeST Address Proxy
  app.get('/api/be-best-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const url = `https://geoservices.wallonie.be/arcgis/rest/services/APP_LOCALISATION/LOCALISATEUR_ADRESSE/GeocodeServer/reverseGeocode?location=${lon},${lat}&distance=100&outSR=4326&f=pjson`;
    
    try {
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Belgium address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Czech Republic RÚIAN Proxy
  app.get('/api/cz-ruian-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const url = `https://vdp.cuzk.cz/vdp/ruian/vse/Vyhledej?souradnice=${lat},${lon}&radius=50&f=json`;
    
    try {
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Czech address not found' });
    } catch (error) {
      const fallbackUrl = `https://api.mapy.cz/geocode?query=${lat},${lon}`;
      try {
        const fbRes = await safeFetch(fallbackUrl);
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          return res.json(fbData);
        }
      } catch (e) {}
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Nominatim Search Mirrors ---
  const NOMINATIM_SEARCH_MIRRORS = [
    'https://nominatim.openstreetmap.org/search',
    'https://nominatim.openstreetmap.fr/search',
    'https://nominatim.osm.ch/search',
    'https://nominatim.openstreetmap.de/search',
    'https://nominatim.openstreetmap.be/search',
    'https://nominatim.openstreetmap.ie/search',
    'https://nominatim.openstreetmap.org.tr/search',
  ];

  /**
   * Robust search using multiple mirrors
   */
  async function performOsmSearch(q: string, options: any = {}) {
    const now = Date.now();
    const mirrors = NOMINATIM_SEARCH_MIRRORS.filter(m => {
      const until = nominatimBlacklist.get(m);
      return !until || now > until;
    });

    const { limit, addressdetails, polygon_geojson, country, countrycodes, viewbox, bounded, accept_language } = options;
    
    const params = new URLSearchParams();
    params.append('format', 'json');
    params.append('q', q);
    if (limit) params.append('limit', limit.toString());
    if (addressdetails) params.append('addressdetails', addressdetails.toString());
    if (polygon_geojson) params.append('polygon_geojson', polygon_geojson.toString());
    if (country) params.append('country', country.toString());
    if (countrycodes) params.append('countrycodes', countrycodes.toString());
    if (viewbox) params.append('viewbox', viewbox.toString());
    if (bounded) params.append('bounded', bounded.toString());
    if (accept_language) params.append('accept-language', accept_language.toString());

    const errors: string[] = [];
    const mirrorsToTry = mirrors.length > 0 ? mirrors : [...NOMINATIM_SEARCH_MIRRORS];

    // Sort: Official first
    mirrorsToTry.sort((a, b) => {
      const aOfficial = a.includes('openstreetmap.org/search');
      const bOfficial = b.includes('openstreetmap.org/search');
      if (aOfficial && !bOfficial) return -1;
      if (!aOfficial && bOfficial) return 1;
      return 0;
    });

    for (const mirror of mirrorsToTry) {
      try {
        const url = `${mirror}?${params.toString()}`;
        const res = await safeFetch(url, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (compatible; AGID-Geogrid-Explorer/2.5.1; +https://github.com/kitauracode/geogrid-explorer)',
            'Accept-Language': accept_language || 'en'
          }
        }, 20000);
        
        const contentType = res.headers.get('content-type') || '';
        
        if (res.ok && contentType.includes('json')) {
          const text = await res.text();
          const trimmed = text.trim();
          if (trimmed.startsWith('<!DOCTYPE html>') || trimmed.startsWith('<html') || !trimmed.startsWith('[')) {
            nominatimBlacklist.set(mirror, now + NOMINATIM_BLACKLIST_DURATION);
            continue;
          }
          try {
            return JSON.parse(text);
          } catch (e) {
            nominatimBlacklist.set(mirror, now + NOMINATIM_BLACKLIST_DURATION);
            continue;
          }
        } else {
          const isRateLimit = res.status === 429;
          const isServerError = res.status >= 500;
          const isNotFound = res.status === 404;
          
          if (isRateLimit || isServerError || isNotFound) {
            nominatimBlacklist.set(mirror, now + NOMINATIM_BLACKLIST_DURATION);
          }
          errors.push(`${mirror} (${res.status})`);
        }
      } catch (e: any) {
        const msg = e.message || String(e);
        const cause = e?.cause?.message || e?.cause?.code || e?.cause || '';
        const causeStr = cause.toString();
        const isDnsError = msg.includes('getaddrinfo') || msg.includes('ENOTFOUND') || msg.includes('EAI_AGAIN') || 
                           causeStr.includes('ENOTFOUND') || causeStr.includes('EAI_AGAIN') || 
                           causeStr.includes('EHOSTUNREACH') || causeStr.includes('ECONNREFUSED');
        const isNetworkError = isDnsError || msg.includes('fetch failed') || msg.includes('timeout') || msg.includes('aborted');
        
        const blacklistDuration = isDnsError ? 1000 * 60 * 120 : (isNetworkError ? 60000 : NOMINATIM_BLACKLIST_DURATION);
        nominatimBlacklist.set(mirror, now + blacklistDuration);
        errors.push(`${mirror} [${msg}]`);
        
        // Silent mirror failures
        if (!isNetworkError && !msg.includes('429')) {
          console.debug(`[API] Search Mirror Failed: ${mirror} - ${msg}`);
        }
      }
    }
    
    // AI Fallback before failure
    const geminiResults = await performGeminiSearch(q, accept_language || 'en', limit || 5);
    if (geminiResults.length > 0) {
      console.log(`[API] Mirror failure for search "${q}". Recovered via Gemini AI.`);
      return geminiResults;
    }
    
    console.warn(`[API] All search mirrors failed. Returning empty results.`);
    return [];
  }

  // Spain Catastro Proxy
  app.get('/api/es-catastro-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const url = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPLOC?Provincia=&Municipio=&Lon=${lon}&Lat=${lat}`;
    
    try {
      const response = await safeFetch(url);
      if (response.ok) {
        const xmlText = await response.text();
        return res.send(xmlText);
      }
      res.status(response.status).json({ error: 'Spain catastro not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // China Postcode Proxy
  app.get('/api/cn-postcode', async (req, res) => {
    const pc = req.query.pc as string;
    try {
      const data = await performOsmSearch('', { postalcode: pc, countrycodes: 'cn', addressdetails: 1, accept_language: 'zh' });
      return res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Geocoding failed' });
    }
  });

  // Asia & Oceania Proxy
  app.get('/api/asia-oceania-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const cc = req.query.cc as string;
    
    if (!lat || !lon || !cc) {
      return res.status(400).json({ error: 'Missing coordinates or country code' });
    }

    const cacheKey = `asia_oceania_${cc}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    const cached = getFromRegionalCache(cacheKey);
    if (cached) return res.json(cached);

    let lang = 'en';
    switch(cc) {
      // East Asia
      case 'jp': lang = 'ja'; break;
      case 'cn': lang = 'zh'; break;
      case 'kr': lang = 'ko'; break;
      case 'tw': lang = 'zh-TW'; break;
      case 'hk': lang = 'zh-HK,en'; break;
      case 'mo': lang = 'zh-MO,pt'; break;
      case 'mn': lang = 'mn'; break;
      case 'kp': lang = 'ko'; break;
      // Southeast Asia
      case 'vn': lang = 'vi'; break;
      case 'th': lang = 'th'; break;
      case 'my': lang = 'ms,en'; break;
      case 'sg': lang = 'en,zh,ms,ta'; break;
      case 'id': lang = 'id'; break;
      case 'ph': lang = 'tl,en'; break;
      case 'kh': lang = 'km'; break;
      case 'la': lang = 'lo'; break;
      case 'mm': lang = 'my'; break;
      case 'bn': lang = 'ms,en'; break;
      case 'tl': lang = 'pt,tet'; break;
      // Oceania
      case 'au': lang = 'en-AU'; break;
      case 'nz': lang = 'en-NZ,mi'; break;
      case 'fj': lang = 'en,fj,hif'; break;
      case 'pg': lang = 'en,tpi,ho'; break;
      case 'sb': lang = 'en'; break;
      case 'vu': lang = 'bi,en,fr'; break;
      case 'ws': lang = 'sm,en'; break;
      case 'to': lang = 'to,en'; break;
      case 'ki': lang = 'en'; break;
      case 'mh': lang = 'en'; break;
      case 'fm': lang = 'en'; break;
      case 'nr': lang = 'en'; break;
      case 'pw': lang = 'en'; break;
      case 'tv': lang = 'en'; break;
    }

    try {
      const data = await performOsmReverse(lat, lon, lang);
      setRegionalCache(cacheKey, data);
      return res.json(data);
    } catch (error: any) {
      console.error(`[API] Asia/Oceania Proxy Error (${cc}):`, error);
      res.status(500).json({ error: error.message || 'Geocoding failed' });
    }
  });

  // Terrain Tile Proxy
  app.get('/api/terrain/:z/:x/:y.png', async (req, res) => {
    const { z, x, y } = req.params;
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    
    try {
      const response = await safeFetch(url);

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.set('Access-Control-Allow-Origin', '*');
        return res.send(Buffer.from(buffer));
      }
      res.status(response.status).send('Tile not found');
    } catch (error) {
      console.error('Terrain Proxy Error:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Mountain/Peak Detection via Overpass API (Free, Open Source)
  // Replaces MountainFYI with direct OSM data
  app.get('/api/mountain/nearby', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      const overpassQuery = `
        [out:json][timeout:15];
        node["natural"="peak"](around:10000,${lat},${lon});
        out body qt;
      `;
      
      let data;
      try {
        data = await fetchFromOverpass(overpassQuery);
      } catch (e) {
        console.warn('[API] Mountain API: Overpass failed, using landmarks fallback');
        // If high-density landmark query fails, try a broader landmarks fallback
        data = await fetchLandmarksFallback(lat, lon);
      }

      const peaks = (data.elements || []).map((el: any) => ({
        name: el.tags.name || 'Unnamed Peak',
        elevation: el.tags.ele ? parseInt(el.tags.ele) : null,
        lat: el.lat,
        lon: el.lon
      })).sort((a: any, b: any) => {
        // Sort by elevation if available
        if (a.elevation && b.elevation) return b.elevation - a.elevation;
        return 0;
      });
      
      return res.json({ peaks, source: 'OSM-Overpass' });
    } catch (error) {
      console.error('Mountain API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Geological Risk API (Simulated based on OSM and Elevation)
  // Provides risk assessment for landslides, flooding, and terrain type
  app.get('/api/geological-risk', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      // 1. Fetch nearby features from Overpass
      const overpassQuery = `
        [out:json][timeout:25];
        (
          way["natural"="water"](around:1000,${lat},${lon});
          way["natural"="wetland"](around:1000,${lat},${lon});
          way["natural"="wood"](around:1000,${lat},${lon});
          way["landuse"="forest"](around:1000,${lat},${lon});
          way["landuse"="residential"](around:1000,${lat},${lon});
          way["landuse"="industrial"](around:1000,${lat},${lon});
        );
        out tags;
      `;
      
      let osmData;
      try {
        osmData = await fetchFromOverpass(overpassQuery);
      } catch (e) {
        console.warn('[API] Geological Risk: Overpass failed, using empty data');
        osmData = { elements: [] };
      }

      let elevation = 0;
      const elevData = await getElevationData(lat, lon);
      if (elevData) {
        elevation = elevData.elevation;
      }

      // 2. Analyze Land Cover
      const tags = osmData.elements.map((el: any) => el.tags);
      const isUrban = tags.some((t: any) => t.landuse === 'residential' || t.landuse === 'industrial');
      const isForest = tags.some((t: any) => t.natural === 'wood' || t.landuse === 'forest');
      const isWetland = tags.some((t: any) => t.natural === 'wetland');
      const hasWater = tags.some((t: any) => t.natural === 'water');

      // 3. Calculate Risks (Simulated)
      // Landslide risk: High if in forest/mountainous area with steep slope (simulated by elevation > 500)
      let landslideRisk = 'Low';
      if (elevation > 1000 && isForest) landslideRisk = 'High';
      else if (elevation > 500) landslideRisk = 'Moderate';

      // Flood risk: High if near water/wetland and low elevation
      let floodRisk = 'Low';
      if (elevation < 50 && (hasWater || isWetland)) floodRisk = 'High';
      else if (elevation < 100 && (hasWater || isWetland)) floodRisk = 'Moderate';

      // Seismic risk: Simulated based on general tectonic regions (very rough)
      let seismicRisk = 'Low';
      const isPacificRingOfFire = (lon > 120 && lon < 150) || (lon > -130 && lon < -60);
      if (isPacificRingOfFire) seismicRisk = 'Moderate to High';

      return res.json({
        elevation,
        land_cover: isUrban ? 'Urban' : (isForest ? 'Forest' : 'Open Land'),
        risks: {
          landslide: landslideRisk,
          flood: floodRisk,
          seismic: seismicRisk
        },
        source: 'OSM + Open-Elevation (Simulated)'
      });
    } catch (error) {
      console.error('Geological Risk API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GLWD (Global Lakes and Wetlands Database) / Flood Risk API Proxy
  // Evaluates flood/water risk for delivery routing
  app.get('/api/water-risk', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
      // In a production environment, this would query a PostGIS database loaded with GLWD v2 data.
      // For this implementation, we simulate the risk based on proximity to known water bodies via OSM Overpass
      const overpassQuery = `
        [out:json][timeout:15];
        (
          way["natural"="water"](around:500,${lat},${lon});
          way["waterway"](around:500,${lat},${lon});
          way["natural"="wetland"](around:500,${lat},${lon});
          relation["natural"="water"](around:500,${lat},${lon});
        );
        out count qt;
      `;
      
      let data;
      try {
        data = await fetchFromOverpass(overpassQuery);
      } catch (e) {
        // Only warn if it's not a cached failure to reduce log spam
        if (e instanceof Error && e.message !== 'Recently failed query') {
          console.warn('[API] Water Risk: Overpass failed, using default risk');
        }
        data = { elements: [] };
      }

      const waysCount = parseInt(data.elements?.[0]?.tags?.ways || '0', 10);
      const relsCount = parseInt(data.elements?.[0]?.tags?.relations || '0', 10);
      const waterCount = waysCount + relsCount;
      
      let risk = 'Low';
      if (waterCount > 5) risk = 'High (Floodplain/Wetland)';
      else if (waterCount > 0) risk = 'Moderate (Near Water)';
      
      return res.json({
        risk_level: risk,
        water_bodies_nearby: waterCount,
        source: 'GLWD-simulated (OSM)'
      });
    } catch (error) {
      console.error('Water Risk API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Caching for Regional Proxies ---
  const regionalCache = new Map<string, { data: any, timestamp: number }>();
  const REGIONAL_CACHE_TTL = 1000 * 60 * 60 * 3; // 3 hours

  function getFromRegionalCache(key: string) {
    const entry = regionalCache.get(key);
    if (entry && Date.now() - entry.timestamp < REGIONAL_CACHE_TTL) {
      return entry.data;
    }
    return null;
  }

  function setRegionalCache(key: string, data: any) {
    regionalCache.set(key, { data, timestamp: Date.now() });
    if (regionalCache.size > 2000) {
      const firstKey = regionalCache.keys().next().value;
      if (firstKey) regionalCache.delete(firstKey);
    }
  }

  // Marine Regions API Proxy
  app.get('/api/marine-regions', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Missing or invalid coordinates' });
    
    const cacheKey = `marine_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    const cached = getFromRegionalCache(cacheKey);
    if (cached) return res.json(cached);
    
    try {
      const data = await fetchMarineRegionsWithFallback(lat, lon);
      setRegionalCache(cacheKey, data);
      res.setHeader('Content-Type', 'application/json');
      return res.json(data);
    } catch (error) {
      console.error('[API] Marine Regions Proxy Error:', error);
      res.status(503).json({ error: error instanceof Error ? error.message : 'Marine Regions service unavailable' });
    }
  });

  // Japan HeartRails Geo API Proxy
  app.get('/api/jp-heartrails', async (req, res) => {
    const { lat, lon } = req.query;
    const cacheKey = `heartrails_${lat}_${lon}`;
    const cached = getFromRegionalCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const response = await safeFetch(`https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=${lon}&y=${lat}`, {}, 25000);
      
      if (response.ok) {
        const data = await response.json();
        setRegionalCache(cacheKey, data);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.json(data);
      }
      
      // Retry for certain failures
      if (response.status >= 500 || response.status === 408 || response.status === 429) {
        console.log(`[API] Retrying HeartRails (${response.status})...`);
        const retryRes = await safeFetch(`https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=${lon}&y=${lat}`, {}, 30000);
        if (retryRes.ok) {
          const data = await retryRes.json();
          setRegionalCache(cacheKey, data);
          return res.json(data);
        }
        return res.status(retryRes.status).json({ error: `HeartRails failed after retry: ${retryRes.status}` });
      }
      
      res.status(response.status).json({ error: `HeartRails returned ${response.status}` });
    } catch (error: any) {
      console.error('[API] HeartRails Proxy Critical Error:', error.message || error);
      res.status(503).json({ error: 'HeartRails temporary unavailable' });
    }
  });

  // Taiwan NLSC API Proxy
  app.get('/api/tw-nlsc', async (req, res) => {
    const { lat, lon } = req.query;
    try {
      const response = await safeFetch(`https://api.nlsc.gov.tw/other/TownVillagePointQuery/${lon}/${lat}`);
      if (response.ok) {
        const xmlText = await response.text();
        return res.send(xmlText);
      }
      res.status(response.status).json({ error: 'NLSC data not found' });
    } catch (error) {
      console.error('[API] TW NLSC Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Nominatim Search Proxy
  app.get('/api/osm-search', async (req, res) => {
    const { q, viewbox, bounded, limit, polygon_geojson } = req.query as any;
    if (!q) return res.status(400).json({ error: 'Missing query' });
    
    try {
      const data = await performOsmSearch(q, { 
        limit: limit || 10, 
        addressdetails: 1, 
        polygon_geojson: polygon_geojson === '1' ? 1 : 0,
        viewbox,
        bounded
      });
      return res.json(data);
    } catch (error: any) {
      console.error('[API] OSM Search Error:', error);
      res.status(500).json({ error: error.message || 'Search failed' });
    }
  });

  // Nominatim Reverse Proxy (Global Fallback)
  app.get('/api/osm-reverse', async (req, res) => {
    const { lat, lon, lang, zoom, cc } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Missing coordinates' });
    
    try {
      const l = parseFloat(lat as string);
      const n = parseFloat(lon as string);
      const z = zoom ? parseInt(zoom as string) : 18;
      const ln = lang ? (lang as string) : 'en';
      const countryCode = cc ? (cc as string) : undefined;

      const data = await performOsmReverse(l, n, ln, z, countryCode);
      res.json(data);
    } catch (error: any) {
      console.error('[API] OSM Reverse Error:', error);
      res.status(500).json({ error: error.message || 'Geocoding failed' });
    }
  });

  // US Census Geocoder Proxy
  app.get('/api/us-census', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Missing coordinates' });
    
    try {
      const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Census data not found' });
    } catch (error) {
      console.error('[API] US Census Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Country Boundary Proxy (GeoJSON)
  app.get('/api/country-boundary', async (req, res) => {
    const { cc } = req.query;
    if (!cc) return res.status(400).json({ error: 'Missing country code' });
    
    try {
      const data = await performOsmSearch('', { country: cc, polygon_geojson: 1, limit: 1 });
      if (data && data[0] && data[0].geojson) {
        return res.json(data[0].geojson);
      }
      res.status(404).json({ error: 'Boundary not found' });
    } catch (error: any) {
      console.error('[API] Country Boundary Error:', error);
      res.status(502).json({ error: error.message || 'Fetch failed' });
    }
  });

  // Country Cities/Municipalities Proxy
  app.get('/api/country-cities', async (req, res) => {
    const { cc } = req.query;
    if (!cc) return res.status(400).json({ error: 'Missing country code' });
    
    // Query for cities, towns, and municipalities within the country area
    // Using a simpler query for speed
    const query = `
      [out:json][timeout:40];
      area["ISO3166-1"="${cc.toString().toUpperCase()}"]->.searchArea;
      (
        node["place"~"city|town"](area.searchArea);
        node["place"="municipality"](area.searchArea);
      );
      out body qt;
    `;
    
    try {
      let data;
      try {
        data = await fetchFromOverpass(query);
      } catch (e) {
        console.warn('[API] Country Cities: Overpass failed, using empty data');
        data = { elements: [] };
      }

      const cities = (data.elements || []).map((el: any) => ({
        name: el.tags.name,
        nameEn: el.tags['name:en'],
        type: el.tags.place,
        lat: el.lat,
        lon: el.lon
      })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      
      res.json(cities);
    } catch (error) {
      console.error('[API] Country Cities Error:', error);
      res.status(500).json({ error: 'Failed to fetch cities' });
    }
  });

  // Country Stats Proxy (Population, Area, etc.)
  app.get('/api/country-stats', async (req, res) => {
    const { cc } = req.query;
    if (!cc) return res.status(400).json({ error: 'Missing country code' });

    try {
      const response = await safeFetch(`https://restcountries.com/v3.1/alpha/${cc}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data[0]) {
          const stats = {
            population: data[0].population,
            area: data[0].area,
            region: data[0].region,
            subregion: data[0].subregion,
            capital: data[0].capital?.[0]
          };
          return res.json(stats);
        }
      }
      res.status(404).json({ error: 'Country stats not found' });
    } catch (error) {
      console.error('[API] Country Stats Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Open-Meteo Weather Proxy
  app.get('/api/weather', async (req, res) => {
    const { latitude, longitude } = req.query;
    if (!latitude || !longitude) return res.status(400).json({ error: 'Missing coordinates' });

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
      const response = await safeFetch(url, {}, 15000);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
           const data = await response.json();
           return res.json(data);
        }
      }
      res.status(response.status || 503).json({ error: 'Weather service unavailable' });
    } catch (error) {
      console.error('[API] Weather Proxy Error:', error);
      res.status(503).json({ error: 'Weather fetch failed' });
    }
  });

  // --- Vector Tile Mirror for Labels (High-Res Gazeteer) ---
  app.get('/api/labels/:z/:x/:y.pbf', async (req, res) => {
    const { z, x, y } = req.params;
    const source = `https://tiles.openfreemap.org/planet/${z}/${x}/${y}.pbf`;
    
    try {
      const response = await fetch(source, { 
        headers: { 'User-Agent': 'AGID-Grid-Explorer/2.1' },
        signal: AbortSignal.timeout(5000) 
      });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'application/x-protobuf');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(Buffer.from(buffer));
      }
      res.status(response.status).send('Label tile fail');
    } catch (e) {
      res.status(503).send('Label service unavailable');
    }
  });

  // Denmark DAWA Address Service (Official, Free)
  app.get('/api/dk-address', async (req, res) => {
    const { lat, lon } = req.query;
    try {
      const response = await safeFetch(`https://dawa.aws.dk/adgangsadresser/reverse?x=${lon}&y=${lat}&format=json`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'DAWA lookup failed' });
    } catch (error) {
      console.error('DAWA Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Norway Kartverket Address Service (Official, Free)
  app.get('/api/no-address', async (req, res) => {
    const { lat, lon } = req.query;
    try {
      const response = await safeFetch(`https://ws.geonorge.no/adresser/v1/punktsok?lon=${lon}&lat=${lat}&radius=50`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Kartverket lookup failed' });
    } catch (error) {
      console.error('Kartverket Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Poland GUGiK Address Service (Official, Free)
  app.get('/api/pl-address', async (req, res) => {
    const { lat, lon } = req.query;
    try {
      // GUGiK UISL reverse search
      const response = await safeFetch(`https://services.gugik.gov.pl/uisl/?request=getaddressbyxy&x=${lon}&y=${lat}`);
      if (response.ok) {
        const text = await response.text();
        // GUGiK often returns plain text or simple formatted strings
        return res.json({ result: text });
      }
      res.status(response.status).json({ error: 'GUGiK lookup failed' });
    } catch (error) {
      console.error('GUGiK Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Overpass Proxy: http://0.0.0.0:${PORT}/api/overpass`);
  });
}

startServer();
