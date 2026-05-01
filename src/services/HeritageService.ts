
import { RegionalLandmark } from './WestAsiaService';

export interface HeritageContext {
  unescoSites: RegionalLandmark[];
  historicSites: RegionalLandmark[];
}

/**
 * Heritage Service
 * Fetches UNESCO World Heritage Sites and other historic landmarks using Overpass API.
 */
export async function fetchHeritageContext(lat: number, lon: number): Promise<HeritageContext> {
  const results: HeritageContext = {
    unescoSites: [],
    historicSites: []
  };

  try {
    // Overpass query for UNESCO World Heritage Sites and historic landmarks
    // around:20000 (20km) for UNESCO sites, 5000 (5km) for historic sites
    const query = `
      [out:json][timeout:30];
      (
        // UNESCO World Heritage Sites
        node["heritage:operator"="unesco"](around:20000,${lat},${lon});
        way["heritage:operator"="unesco"](around:20000,${lat},${lon});
        relation["heritage:operator"="unesco"](around:20000,${lat},${lon});
        
        node["heritage"="2"](around:20000,${lat},${lon});
        way["heritage"="2"](around:20000,${lat},${lon});
        relation["heritage"="2"](around:20000,${lat},${lon});

        node["unesco_world_heritage"="yes"](around:20000,${lat},${lon});
        way["unesco_world_heritage"="yes"](around:20000,${lat},${lon});
        relation["unesco_world_heritage"="yes"](around:20000,${lat},${lon});

        // Other significant historic sites
        node["historic"~"castle|fort|monument|ruins|archaeological_site"](around:5000,${lat},${lon});
        way["historic"~"castle|fort|monument|ruins|archaeological_site"](around:5000,${lat},${lon});
        relation["historic"~"castle|fort|monument|ruins|archaeological_site"](around:5000,${lat},${lon});
      );
      out body center qt;
    `;

    const fetchWithRetry = async (url: string, body: string, retries = 2): Promise<Response> => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'text/plain' },
          signal: AbortSignal.timeout(90000)
        });
        if (!response.ok && response.status >= 500 && retries > 0) throw new Error('Retry');
        return response;
      } catch (e) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000 * (3 - retries)));
          return fetchWithRetry(url, body, retries - 1);
        }
        throw e;
      }
    };

    const res = await fetchWithRetry('/api/overpass', query);

    if (res.ok) {
      const data = await res.json();
      data.elements.forEach((el: any) => {
        const name = el.tags.name || el.tags['name:en'] || el.tags['official_name'] || "Unnamed Heritage Site";
        const type = el.tags.historic || el.tags.heritage || "Heritage Site";
        
        const landmark: RegionalLandmark = {
          name,
          type,
          distance: 0 // Could calculate if needed
        };

        const isUnesco = el.tags['heritage:operator'] === 'unesco' || 
                        el.tags['heritage'] === '2' || 
                        el.tags['unesco_world_heritage'] === 'yes';

        if (isUnesco) {
          // Avoid duplicates if multiple tags match
          if (!results.unescoSites.find(s => s.name === name)) {
            results.unescoSites.push(landmark);
          }
        } else {
          if (!results.historicSites.find(s => s.name === name)) {
            results.historicSites.push(landmark);
          }
        }
      });
    }
  } catch (e) {
    console.error('Heritage Context Error:', e);
  }

  return results;
}
