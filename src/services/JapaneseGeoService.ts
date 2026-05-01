
/**
 * Specialized service for Japanese Geographical Data.
 * Fetches detailed administrative and cultural information for Japan.
 */

export interface JapaneseGeoContext {
  prefecture: string;
  prefecture_en?: string;
  city: string;
  city_en?: string;
  ward?: string; // Ku
  town?: string; // Cho/Son
  chome?: string; // Chome
  block?: string; // Banchi
  number?: string; // Go
  building?: string; // Building names
  historical_name?: string;
  former_village?: string;
  local_landmark?: string;
  is_heavy_snow_area?: boolean;
  is_depopulated_area?: boolean;
}

export async function fetchJapaneseGeoContext(lat: number, lon: number): Promise<JapaneseGeoContext | null> {
  // Optimized query: limited building search radius and focused admin hierarchy
  const query = `
    [out:json][timeout:25];
    (
      node(around:20,${lat},${lon})["building"];
      way(around:20,${lat},${lon})["building"];
      node(around:80,${lat},${lon})["admin_level"];
      way(around:80,${lat},${lon})["admin_level"];
      relation(around:80,${lat},${lon})["admin_level"];
      node(around:150,${lat},${lon})["historic"];
    );
    out tags;
  `;

  async function performFetch(q: string, timeout: number) {
    const response = await fetch('/api/overpass', {
      method: 'POST',
      body: JSON.stringify({ query: q }),
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeout)
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  }

  try {
    let data;
    try {
      data = await performFetch(query, 120000);
    } catch (e) {
      if (e instanceof Error && (e.name === 'AbortError' || e.message.includes('timeout') || e.message.includes('Failed to fetch'))) {
        console.warn('Japanese Geo Context Initial Query Timed Out or Failed. Retrying with simpler query...');
        // Simpler query: just admin levels and building name if any
        const simpleQuery = `[out:json][timeout:15];(node(around:20,${lat},${lon})["building"];way(around:20,${lat},${lon})["building"];node(around:100,${lat},${lon})["admin_level"];way(around:100,${lat},${lon})["admin_level"];);out tags;`;
        data = await performFetch(simpleQuery, 60000);
      } else {
        throw e;
      }
    }
    
    if (!data || !data.elements) return null;
    
    const context: Partial<JapaneseGeoContext> = {};
    
    for (const el of data.elements) {
      const tags = el.tags;
      if (!tags) continue;

      // Extract building name if very close
      if (tags.building && tags.name && !context.building) {
        context.building = tags.name;
      }

      // Administrative levels in Japan:
      // 4: Prefecture
      // 7: City/Ward
      // 8: Town/Village
      // 9: Chome
      
      if (tags.admin_level === '4') {
        context.prefecture = tags.name;
        context.prefecture_en = tags['name:en'];
      }
      if (tags.admin_level === '7') {
        if (tags.name?.endsWith('区')) context.ward = tags.name;
        else context.city = tags.name;
      }
      if (tags.admin_level === '8') {
        if (tags.name?.endsWith('区')) context.ward = tags.name; // Some special cases
        else if (tags.name?.endsWith('市')) context.city = tags.name;
        else context.town = tags.name;
      }
      if (tags.admin_level === '9') {
        context.chome = tags.name;
      }
      
      if (tags.place === 'neighbourhood' || tags.place === 'suburb') {
        if (!context.town) context.town = tags.name;
      }

      if (tags.historic) {
        context.historical_name = tags.name;
      }
      if (tags.note?.includes('旧村') || tags.description?.includes('旧村')) {
        context.former_village = tags.name;
      }
    }

    return Object.keys(context).length > 0 ? context as JapaneseGeoContext : null;
  } catch (error) {
    console.error('Japanese Geo Context Fetch Error:', error);
    return null;
  }
}
