import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initPostalCodeDB, getNearestPostalCode } from './src/services/PostalCodeDB';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const apiCache = new Map<string, { data: any, timestamp: number }>();
  const API_CACHE_TTL = 1000 * 60 * 60; // 1 hour cache

  /**
   * Safe fetch with timeout and error handling for all proxy routes
   */
  async function safeFetch(url: string, options: RequestInit = {}, timeoutMs = 60000) {
    // Basic cache check
    const cacheKey = `${url}-${JSON.stringify(options.body || '')}`;
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < API_CACHE_TTL) {
      return {
        ok: true,
        status: 200,
        json: async () => cached.data,
        headers: new Headers({ 'x-cache': 'HIT' })
      } as any;
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Merge headers carefully
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://ais-dev-pccznu564ainowkzzbgqek-10301310581.asia-northeast1.run.app/'
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
      if (duration > 10000) {
        console.warn(`[API] Slow response (${duration}ms): ${url}`);
      }

      // Cache successful JSON responses in background
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const cloned = response.clone();
        cloned.json().then(data => {
          const cacheKey = `${url}-${JSON.stringify(options.body || '')}`;
          apiCache.set(cacheKey, { data, timestamp: Date.now() });
        }).catch(() => {});
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - start;
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[API] Timeout after ${duration}ms: ${url}`);
      } else {
        console.error(`[API] Fetch Error for ${url}:`, error);
      }
      throw error;
    }
  }

  // Elevation Cache (Small in-memory cache)
  const elevationCache = new Map<string, { val: number, timestamp: number }>();
  const ELEVATION_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

  /**
   * Internal helper for robust elevation lookup with multiple fallbacks
   */
  async function getElevationData(lat: number, lon: number): Promise<{ elevation: number, source: string } | null> {
    const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    const cached = elevationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < ELEVATION_CACHE_TTL)) {
      return { elevation: cached.val, source: 'cache' };
    }

    // Try multiple sources in order of reliability
    const sources = [
      { 
        name: 'opentopodata-srtm30m', 
        url: `https://api.opentopodata.org/v1/srtm30m?locations=${lat},${lon}`,
        timeout: 25000 
      },
      { 
        name: 'open-elevation', 
        url: `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`,
        timeout: 30000 
      }
    ];

    for (const source of sources) {
      try {
        const res = await safeFetch(source.url, {}, source.timeout);
        if (res.ok) {
          const data = await res.json();
          const elev = data?.results?.[0]?.elevation;
          if (typeof elev === 'number') {
            elevationCache.set(cacheKey, { val: elev, timestamp: Date.now() });
            // Clean up cache if too large
            if (elevationCache.size > 5000) {
              const firstKey = elevationCache.keys().next().value;
              if (firstKey) elevationCache.delete(firstKey);
            }
            return { elevation: elev, source: source.name };
          }
        }
      } catch (e: any) {
        // Silently log only if it's not an abort/timeout to keep logs clean
        const isAbort = e instanceof Error && (e.name === 'AbortError' || e.message?.includes('aborted'));
        if (!isAbort) {
          console.warn(`[Elevation Proxy] Source ${source.name} failed:`, e.message || e);
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
    'https://overpass.osm.ch/api/interpreter',          // Switzerland (Highly Reliable)
    'https://overpass.kumi.systems/api/interpreter',    // Kumi (Global)
    'https://overpass.private.coffee/api/interpreter',  // Coffee (German)
    'https://overpass-api.de/api/interpreter',          // Germany (Main - Demoted due to recent instability)
    'https://overpass.osm.ie/api/interpreter',          // Ireland
    'https://overpass.osmosur.org/api/interpreter',     // South America
    'https://overpass.be/api/interpreter',              // Belgium
    'https://overpass.nchc.org.tw/api/interpreter',     // Taiwan
    'https://overpass.smartmaps.by/api/interpreter',    // Belarus
    // Removed failing/unstable: lz4, z, openstreetmap.fr, hotosm.org
  ];

  const mirrorBlacklist = new Map<string, number>();
  const BLACKLIST_DURATION_RATE_LIMIT = 1000 * 60 * 10; // 10 min
  const BLACKLIST_DURATION_ERROR = 1000 * 60 * 15; // 15 min
  const BLACKLIST_DURATION_TIMEOUT = 1000 * 60 * 20; // 20 min
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
      console.warn('[Overpass Proxy] Critical: Mirror pool exhausted. Refreshing.');
      mirrorBlacklist.clear();
      mirrorsToTry = [...OVERPASS_MIRRORS];
    }

    // Dynamic prioritization
    mirrorsToTry.sort((a, b) => {
      // Tier 1: Swiss (Highly Reliable)
      const t1 = ['osm.ch'];
      const aT1 = t1.some(p => a.includes(p));
      const bT1 = t1.some(p => b.includes(p));
      if (aT1 && !bT1) return -1;
      if (!aT1 && bT1) return 1;

      // Tier 2: Private Coffee (Usually stable)
      const t2 = ['private.coffee'];
      const aT2 = t2.some(p => a.includes(p));
      const bT2 = t2.some(p => b.includes(p));
      if (aT2 && !bT2) return -1;
      if (!aT2 && bT2) return 1;

      // Tier 3: Main DE and Kumi (Global fallbacks)
      const t3 = ['overpass-api.de', 'kumi.systems'];
      const aT3 = t3.some(p => a.includes(p));
      const bT3 = t3.some(p => b.includes(p));
      if (aT3 && !bT3) return -1;
      if (!aT3 && bT3) return 1;
      
      return Math.random() - 0.5;
    });

    const errors: string[] = [];
    const maxAttempts = Math.min(mirrorsToTry.length, 12);
    
    for (let i = 0; i < maxAttempts; i++) {
      const mirror = mirrorsToTry[i];
      try {
        console.log(`[Overpass Proxy] Attempt ${i + 1}/${maxAttempts} @ ${mirror}`);
        
        const controller = new AbortController();
        // Give reliable mirrors enough time but failover if they are totally unresponsive
        const timeoutDuration = i < 3 ? 50000 : 85000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        const response = await fetch(mirror, {
          method: 'POST',
          body: new URLSearchParams({ data: query }).toString(),
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 AGID/2.6'
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
            console.error(`[Overpass Proxy] Invalid JSON from ${mirror}. Snippet: ${text.substring(0, 100)}`);
            throw new Error('Invalid JSON');
          }
        }
        
        if (response.status === 429) {
          mirrorBlacklist.set(mirror, Date.now() + BLACKLIST_DURATION_RATE_LIMIT);
          errors.push(`${mirror}: 429 Rate Limit`);
        } else if (response.status === 406) {
          mirrorBlacklist.set(mirror, Date.now() + BLACKLIST_DURATION_406);
          errors.push(`${mirror}: 406 Not Acceptable`);
        } else {
          mirrorBlacklist.set(mirror, Date.now() + BLACKLIST_DURATION_ERROR);
          errors.push(`${mirror}: HTTP ${response.status}`);
        }
      } catch (e: any) {
        const isTimeout = e.name === 'AbortError' || e.code === 'UND_ERR_CONNECT_TIMEOUT' || (e.message && e.message.includes('Timeout'));
        const isDNS = e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN' || (e.message && e.message.includes('getaddrinfo'));
        const errorDetail = isTimeout ? 'Timeout' : (isDNS ? 'DNS/Connection Failure' : e.message);
        
        console.error(`[Overpass Proxy] Mirror Connection Error: ${mirror} - ${errorDetail}`);
        const blacklistDuration = isDNS ? BLACKLIST_DURATION_DNS : (isTimeout ? BLACKLIST_DURATION_TIMEOUT : BLACKLIST_DURATION_ERROR);
        mirrorBlacklist.set(mirror, Date.now() + blacklistDuration);
        errors.push(`${mirror}: ${errorDetail}`);
      }
    }

    throw new Error(`Overpass service unavailable (tried ${maxAttempts} mirrors): ${errors.join(' | ')}`);
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
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=5&addressdetails=1`;
        const response = await safeFetch(url, {}, 10000);
        if (response.ok) {
          const data = await response.json();
          const addr = data.address || {};
          const seaName = addr.sea || addr.ocean || addr.bay || addr.gulf || addr.strait || addr.water;
          if (seaName) {
            return [{
              preferredGazetteerName: seaName,
              placeType: addr.ocean ? 'Ocean' : 'Sea'
            }];
          }
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
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=de`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'German address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Belgium (Brussels/Flanders/Wallonia) - Using regional Open Data proxies
  app.get('/api/be-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=nl,fr,de`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Belgian address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
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
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=de-AT`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Austrian address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Sweden Lantmäteriet Proxy
  app.get('/api/se-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=sv`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Swedish address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Estonia Maa-amet (Land Board) Proxy
  app.get('/api/ee-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=et`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Estonian address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Latvia LĢIA (Latvian Geospatial Information Agency) Proxy
  app.get('/api/lv-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=lv`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Latvian address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Lithuania Registrų centras Proxy
  app.get('/api/lt-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=lt`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Lithuanian address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Iceland Landmælingar Íslands (National Land Survey of Iceland) Proxy
  app.get('/api/is-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=is`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Icelandic address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Italy Proxy
  app.get('/api/it-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=it`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Italian address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Spain Proxy
  app.get('/api/es-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=es`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Spanish address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Portugal Proxy
  app.get('/api/pt-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=pt`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Portuguese address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Greece Proxy
  app.get('/api/gr-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=el`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Greek address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Malta Proxy
  app.get('/api/mt-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=mt,en`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Maltese address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Cyprus Proxy
  app.get('/api/cy-address', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    try {
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=el,tr,en`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Cypriot address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
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
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=${lang}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Microstate address not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
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
      const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=${lang}`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: `Address not found for ${cc}` });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
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
    const { lat, lon, zoom, addressdetails, lang } = req.query;
    try {
      // Prefer target lang, fallback to English then local
      const acceptLang = lang ? `${lang},en;q=0.9` : 'en';
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=${zoom || 18}&addressdetails=${addressdetails || 1}&accept-language=${acceptLang}`;
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Nominatim reverse geocode failed' });
    } catch (error) {
      console.error('[API] Nominatim Reverse Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/nominatim/search', async (req, res) => {
    const { q, countrycodes, limit, lang } = req.query;
    try {
      const acceptLang = lang ? `${lang},en;q=0.9` : 'en';
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q as string)}&countrycodes=${countrycodes || ''}&limit=${limit || 10}&accept-language=${acceptLang}`;
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Nominatim search failed' });
    } catch (error) {
      console.error('[API] Nominatim Search Error:', error);
      res.status(500).json({ error: 'Internal server error' });
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
      const response = await safeFetch(`https://nominatim.openstreetmap.org/search?postalcode=${pc}&countrycodes=cn&format=json&addressdetails=1&accept-language=zh`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'China postcode not found' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
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
      // EAST ASIA SPECIALIZED FALLBACKS
      if (['jp', 'kr', 'tw', 'hk', 'mo', 'cn'].includes(cc)) {
        try {
          console.log(`[Proxy Fallback] Using Photon/Komoot as fallback for ${cc}...`);
          const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
          const pRes = await safeFetch(photonUrl, {}, 10000);
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData.features?.length > 0) {
              const feat = pData.features[0];
              const p = feat.properties;
              // Map Photon to Nominatim-like structure
              const mapped = {
                place_id: Math.floor(Math.random() * 1000000),
                licence: "Data © OpenStreetMap contributors, ODbL 1.0. https://osm.org/copyright",
                osm_type: "node",
                osm_id: 0,
                lat: lat.toString(),
                lon: lon.toString(),
                display_name: p.name ? `${p.name}, ${p.city || ''}, ${p.state || ''}, ${p.country || ''}` : p.city,
                address: {
                  road: p.street || p.name,
                  city: p.city,
                  state: p.state,
                  postcode: p.postcode,
                  country: p.country,
                  country_code: p.countrycode?.toLowerCase()
                }
              };
              setRegionalCache(cacheKey, mapped);
              return res.json(mapped);
            }
          }
        } catch (e) {
          console.error(`[Proxy Fallback] Photon fallback failed for ${cc}:`, e);
        }
      }

      // Increased timeout slightly for Nominatim and added retry
      const fetchWithRetry = async (retries = 3): Promise<any> => {
        try {
          const response = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=${lang}`, {}, 20000);
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
              return await response.json();
            }
            throw new Error(`Nominatim returned non-JSON: ${contentType}`);
          }
          
          if (response.status === 429) {
             console.warn(`[API] Nominatim Rate Limited (429) for ${cc}. Attempting long backoff...`);
             await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
          }

          if (retries > 0) {
            console.log(`[API] Nominatim retry ${4 - retries} for ${cc}...`);
            return fetchWithRetry(retries - 1);
          }
          
          // Emergency fallback to secondary Photon mirror if primary failed
          console.log(`[Proxy Fallback] Nominatim failed, trying secondary Photon mirror for ${cc}...`);
          const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
          const pRes = await safeFetch(photonUrl, {}, 12000);
          if (pRes.ok) {
             const pData = await pRes.json();
             if (pData.features?.length > 0) {
               const feat = pData.features[0];
               const p = feat.properties;
               return {
                 place_id: 0,
                 display_name: p.name ? `${p.name}, ${p.city || ''}, ${p.country || ''}` : p.city,
                 address: { city: p.city, country: p.country, country_code: p.countrycode?.toLowerCase() }
               };
             }
          }

          throw new Error(`Nominatim failed with status: ${response.status}`);
        } catch (e) {
          if (retries > 0) {
             await new Promise(r => setTimeout(r, 1000));
             return fetchWithRetry(retries - 1);
          }
          throw e;
        }
      };

      const data = await fetchWithRetry();
      setRegionalCache(cacheKey, data);
      return res.json(data);
    } catch (error) {
      console.error(`[API] Asia/Oceania Proxy Error (${cc}):`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
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
      const response = await safeFetch(`https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=${lon}&y=${lat}`, {}, 15000);
      if (response.ok) {
        const data = await response.json();
        setRegionalCache(cacheKey, data);
        return res.json(data);
      }
      res.status(response.status).json({ error: 'HeartRails data not found' });
    } catch (error) {
      console.error('[API] HeartRails Error:', error);
      res.status(500).json({ error: 'Internal server error' });
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
    const { q, bias, limit, polygon_geojson } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });
    
    try {
      const polygonParam = polygon_geojson === '1' ? '&polygon_geojson=1' : '';
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q as string)}&addressdetails=1&limit=${limit || 10}${bias || ''}${polygonParam}`;
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Search failed' });
    } catch (error) {
      console.error('[API] OSM Search Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Nominatim Reverse Proxy (Global Fallback)
  app.get('/api/osm-reverse', async (req, res) => {
    const { lat, lon, lang } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Missing coordinates' });
    
    try {
      // Logic: Prefer target language, always include English as second choice
      // Nominatim supports comma-separated preferences
      const acceptLang = lang ? `${lang},en;q=0.9` : 'en';
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=${acceptLang}`;
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.status(response.status).json({ error: 'Reverse geocode failed' });
    } catch (error) {
      console.error('[API] OSM Reverse Error:', error);
      res.status(500).json({ error: 'Internal server error' });
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
      const url = `https://nominatim.openstreetmap.org/search?country=${cc}&polygon_geojson=1&format=json&limit=1`;
      const response = await safeFetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data[0] && data[0].geojson) {
          return res.json(data[0].geojson);
        }
      }
      res.status(404).json({ error: 'Boundary not found' });
    } catch (error) {
      console.error('[API] Country Boundary Error:', error);
      res.status(500).json({ error: 'Internal server error' });
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
