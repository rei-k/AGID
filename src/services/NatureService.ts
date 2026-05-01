
import { RegionalLandmark } from './WestAsiaService';

export interface NatureContext {
  mountains: RegionalLandmark[];
  beaches: RegionalLandmark[];
  ports: RegionalLandmark[];
  seas: RegionalLandmark[];
  deserts: RegionalLandmark[];
  landCover?: string;
}

/**
 * Nature Service
 * Fetches environmental and geographical features using Overpass API and other open sources.
 */
export async function fetchNatureContext(lat: number, lon: number): Promise<NatureContext> {
  const results: NatureContext = {
    mountains: [],
    beaches: [],
    ports: [],
    seas: [],
    deserts: []
  };

  try {
    // We use a combined Overpass query for efficiency
    const query = `
      [out:json][timeout:30];
      (
        node["natural"="peak"](around:8000,${lat},${lon});
        node["natural"="beach"](around:5000,${lat},${lon});
        way["natural"="beach"](around:5000,${lat},${lon});
        node["harbour"="yes"](around:8000,${lat},${lon});
        way["harbour"="yes"](around:8000,${lat},${lon});
        node["industrial"="port"](around:8000,${lat},${lon});
        way["industrial"="port"](around:8000,${lat},${lon});
        node["place"~"sea|ocean"](around:20000,${lat},${lon});
        node["natural"="desert"](around:20000,${lat},${lon});
        way["natural"="desert"](around:20000,${lat},${lon});
        node["landuse"="harbour"](around:8000,${lat},${lon});
        way["landuse"="harbour"](around:8000,${lat},${lon});
      );
      out body center qt;
    `;

    // Standardized Overpass fetch with long timeout and retry
    const fetchWithRetry = async (url: string, queryBody: string, retries = 2): Promise<Response> => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          body: queryBody,
          headers: { 'Content-Type': 'text/plain' },
          signal: AbortSignal.timeout(90000)
        });
        if (!response.ok && response.status >= 500 && retries > 0) throw new Error('Retry');
        return response;
      } catch (e) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000 * (3 - retries)));
          return fetchWithRetry(url, queryBody, retries - 1);
        }
        throw e;
      }
    };

    const res = await fetchWithRetry('/api/overpass', query);

    if (res.ok) {
      const data = await res.json();
      data.elements.forEach((el: any) => {
        const landmark: RegionalLandmark = {
          name: el.tags.name || el.tags['name:en'] || "Unnamed Feature",
          type: el.tags.natural || el.tags.harbour || el.tags.industrial || el.tags.place || "Feature",
          distance: 0 // We could calculate this if needed
        };

        if (el.tags.natural === 'peak') results.mountains.push(landmark);
        else if (el.tags.natural === 'beach') results.beaches.push(landmark);
        else if (el.tags.harbour === 'yes' || el.tags.industrial === 'port') results.ports.push(landmark);
        else if (el.tags.place === 'sea' || el.tags.place === 'ocean') results.seas.push(landmark);
        else if (el.tags.natural === 'desert') results.deserts.push(landmark);
      });
    }
  } catch (e) {
    console.error('Nature Context Error:', e);
  }

  // Remove redundant geological risk fetch from within NatureService
  // This is now handled centrally in GeocodingService to prevent overloading the server
  return results;
}
