
import { RegionalLandmark } from './WestAsiaService';
import { fetchWithRetry } from '../lib/utils';

export interface SeaContext {
  sea_name: string;
  bathymetry: number;
  features: RegionalLandmark[];
  marine_protected_area?: string;
}

/**
 * Fetch context for Deep Sea and Marine areas
 */
export async function fetchSeaContext(lat: number, lon: number, elevation?: number): Promise<SeaContext | null> {
  // Only proceed if it's likely a sea area (elevation <= 0)
  // Note: some land areas are below sea level, but we'll check marine regions too
  
  const features: RegionalLandmark[] = [];
  let sea_name = "Open Ocean";
  let mpa = undefined;

  try {
    // 1. Marine Regions API via Proxy
    const marineRes = await fetchWithRetry(`/api/marine-regions?lat=${lat}&lon=${lon}`);
    if (marineRes.ok) {
      const data = await marineRes.json();
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          features.push({
            name: item.preferredGazetteerName,
            type: item.placeType,
            distance: 0,
          });
          if (item.placeType === 'Ocean' || item.placeType === 'Sea' || item.placeType === 'Gulf') {
            sea_name = item.preferredGazetteerName;
          }
          if (item.placeType.includes('Protected Area')) {
            mpa = item.preferredGazetteerName;
          }
        });
      }
    }
  } catch (e) {
    console.error('Marine Regions API error:', e);
  }

  // 2. Overpass API for Deep Sea features (Trenches, Ridges, Seamounts)
  const query = `
    [out:json][timeout:35];
    (
      node["natural"~"trench|ridge|seamount|reef"](around:100000,${lat},${lon});
      way["natural"~"trench|ridge|seamount|reef"](around:100000,${lat},${lon});
      relation["natural"~"trench|ridge|seamount|reef"](around:100000,${lat},${lon});
    );
    out center;
  `;

  try {
    const res = await fetchWithRetry('/api/overpass', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' }
    });
    if (res.ok) {
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Sea context parsing error (received non-JSON):", text.substring(0, 100));
        return null;
      }
      
      if (data && data.elements) {
        data.elements.forEach((el: any) => {
          const tags = el.tags || {};
          features.push({
            name: tags.name || tags['name:en'] || el.id,
            type: tags.natural || "Marine Feature",
            distance: 0
          });
        });
      }
    }
  } catch (e) {
    console.error('Sea Overpass error:', e);
  }

  // If no marine regions found and elevation is positive, it's likely land
  if (features.length === 0 && elevation !== undefined && elevation > 0) {
    return null;
  }

  return {
    sea_name,
    bathymetry: elevation || 0,
    features: Array.from(new Set(features.map(f => JSON.stringify(f)))).map(s => JSON.parse(s)),
    marine_protected_area: mpa
  };
}
