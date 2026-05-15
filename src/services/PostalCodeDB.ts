import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import KDBush from 'kdbush';
import * as geokdbush from 'geokdbush';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(process.cwd(), 'data', 'postal_codes');

// Supported countries for this feature (Asia, Spanish-speaking regions)
const SUPPORTED_COUNTRIES = ['JP', 'KR', 'CN', 'SG', 'TH', 'MY', 'ID', 'PH', 'ES', 'MX', 'CO', 'AR', 'CL'];

interface PostalRecord {
  countryCode: string;
  postalCode: string;
  placeName: string;
  adminName1: string;
  adminName2: string;
  adminName3: string;
  lat: number;
  lon: number;
}

interface CountryIndex {
  records: PostalRecord[];
  index: KDBush;
}

const db: Record<string, CountryIndex> = {};
const loadingStatus: Record<string, boolean> = {};
const failedDownloads = new Set<string>();

export async function initPostalCodeDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
 
  // Load data for supported countries SEQUENTIALLY to save memory
  const loadSequentially = async () => {
    for (const cc of SUPPORTED_COUNTRIES) {
      try {
        await loadCountryData(cc);
      } catch (err) {
        console.error(`Failed to load data for ${cc}:`, err);
      }
      // Give some breathing room for GC
      await new Promise(r => setTimeout(r, 1000));
    }
  };

  loadSequentially().catch(err => console.error('Background postal data loading failed:', err));
}

async function loadCountryData(cc: string): Promise<void> {
  if (db[cc] || loadingStatus[cc] || failedDownloads.has(cc)) return;

  // Only attempt for standard 2-letter alphabetic ISO codes.
  // Numeric codes (like '74') or alpha-numeric codes (like 'A1') are sea/other regions.
  if (!/^[A-Z]{2}$/.test(cc)) {
    return;
  }

  loadingStatus[cc] = true;

  const zipPath = path.join(DATA_DIR, `${cc}.zip`);
  const txtPath = path.join(DATA_DIR, `${cc}.txt`);

  try {
    // 1. Download if not exists
    if (!fs.existsSync(txtPath)) {
      if (!fs.existsSync(zipPath)) {
        console.log(`Downloading postal data for ${cc}...`);
        await downloadFileWithRetry(`https://download.geonames.org/export/zip/${cc}.zip`, zipPath);
      }
      
      // 2. Extract
      console.log(`Extracting postal data for ${cc}...`);
      try {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(DATA_DIR, true);
      } catch (e) {
        console.error(`Zip extraction failed for ${cc}. Deleting corrupted file:`, e);
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        throw e;
      }
    }

    // 3. Parse TSV
    console.log(`Parsing postal data for ${cc}...`);
    const content = await fs.promises.readFile(txtPath, 'utf-8');
    const lines = content.split('\n');
    const records: PostalRecord[] = [];

    // Parse in chunks to avoid blocking the event loop too long
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const parts = line.split('\t');
      if (parts.length >= 11) {
        const lat = parseFloat(parts[9]);
        const lon = parseFloat(parts[10]);
        if (!isNaN(lat) && !isNaN(lon)) {
          records.push({
            countryCode: parts[0],
            postalCode: parts[1],
            placeName: parts[2],
            adminName1: parts[3],
            adminName2: parts[5],
            adminName3: parts[7],
            lat,
            lon
          });
        }
      }
      
      // Yield every 5000 lines
      if (i % 5000 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    // 4. Build Spatial Index
    console.log(`Building spatial index for ${cc} (${records.length} records)...`);
    const index = new KDBush(
      records.length,
      64,
      Float64Array
    );
    for (let i = 0; i < records.length; i++) {
      index.add(records[i].lon, records[i].lat);
    }
    index.finish();

    db[cc] = { records, index };
    console.log(`Successfully loaded postal data for ${cc}`);
  } catch (error) {
    failedDownloads.add(cc);
    if (error instanceof Error && error.message.includes('404')) {
      console.log(`Postal data for ${cc} is not available on geonames (404). Skipping future attempts.`);
    } else {
      console.error(`Error processing postal data for ${cc}:`, error);
    }
  } finally {
    loadingStatus[cc] = false;
  }
}

async function downloadFileWithRetry(url: string, dest: string, retries: number = 3): Promise<void> {
  const mirrors = [
    url,
    url.replace('https://download.', 'http://download.'),
    url.replace('https://download.', 'http://www.'),
  ];

  for (let i = 0; i < retries; i++) {
    // Try each mirror in the retry loop
    const currentUrl = mirrors[i % mirrors.length];
    try {
      await downloadFile(currentUrl, dest);
      
      // Basic check if the file is truly a zip
      const stats = fs.statSync(dest);
      if (stats.size < 1000) { // Zip usually > 1KB
        throw new Error(`Downloaded file is too small (${stats.size} bytes)`);
      }
      
      // Try to read zip header
      try {
        new AdmZip(dest);
      } catch (e) {
        throw new Error('Downloaded file is not a valid zip archive');
      }
      
      return;
    } catch (err: any) {
      if (fs.existsSync(dest)) {
        try { fs.unlinkSync(dest); } catch (e) {}
      }
      
      if (i === retries - 1) throw err;
      
      // Don't retry on 404 errors
      if (err.message && err.message.includes('Status 404')) {
        throw err;
      }

      console.warn(`Download failed for ${currentUrl} (attempt ${i + 1}/${retries}): ${err.message}. Retrying in 15s...`);
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  const USER_AGENT = 'Mozilla/5.0 AGID-Applet/1.2 (SearchBot; +https://ais.google.com/build)';
  return new Promise((resolve, reject) => {
    let file = fs.createWriteStream(dest);
    let request: any;
    
    const cleanup = (err: Error | null) => {
      if (request) {
        request.destroy();
        request = null;
      }
      if (file) {
        file.close();
        if (err && fs.existsSync(dest)) {
          try { fs.unlinkSync(dest); } catch (e) {}
        }
        file = null as any;
      }
      if (err) reject(err);
    };

    const options = {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 120000 // Increased to 120s timeout
    };

    const protocol = url.startsWith('https') ? https : http;
    request = protocol.get(url, options, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (response.headers.location) {
          cleanup(null);
          // Recursively follow redirect but ensure we don't loop forever (implicit 1 check here)
          downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        } else {
          cleanup(new Error(`Redirect without location: ${response.statusCode}`));
        }
        return;
      }
      if (response.statusCode !== 200) {
        cleanup(new Error(`Failed to download from ${url}: Status ${response.statusCode}`));
        return;
      }

      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html') || contentType.includes('text/plain')) {
         // Probably an error page
         cleanup(new Error(`Server returned text (${contentType}) instead of binary data`));
         return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        if (file) {
          file.close();
          file = null as any;
          resolve();
        }
      });
      
      response.on('error', (err) => {
        cleanup(err);
      });
    });

    request.on('error', (err: any) => {
      cleanup(err);
    });

    request.on('timeout', () => {
      cleanup(new Error('Download connection timeout reached'));
    });
  });
}

export async function getNearestPostalCode(lat: number, lon: number, cc: string): Promise<PostalRecord | null> {
  // Only process standard 2-letter alphabetic ISO codes
  if (!/^[A-Z]{2}$/.test(cc)) return null;

  // Ensure data is loaded
  if (!db[cc]) {
    await loadCountryData(cc);
  }
  
  const countryDb = db[cc];
  if (!countryDb) return null;

  // Find nearest point
  const nearestIndices = geokdbush.around(countryDb.index, lon, lat, 1);
  if (nearestIndices.length > 0) {
    const index = nearestIndices[0];
    return countryDb.records[index];
  }
  
  return null;
}
