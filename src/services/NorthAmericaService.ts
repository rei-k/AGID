/**
 * Service for fetching regional context for North America (USA, Canada, Mexico).
 */

export interface NorthAmericaContext {
  state?: string;
  county?: string;
  census_tract?: string;
  landmarks: {
    name: string;
    type: string;
    distance: number;
  }[];
}

/**
 * Fetches regional context for North America using Overpass API.
 */
export async function fetchNorthAmericaContext(lat: number, lon: number, cc: string): Promise<NorthAmericaContext | null> {
  const radius = 2000;
  
  // Query for administrative boundaries (State, County) and landmarks
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"](around:${radius},${lat},${lon});
      node["historic"](around:${radius},${lat},${lon});
      node["leisure"="park"](around:${radius},${lat},${lon});
      way["boundary"="administrative"]["admin_level"~"4|6"](around:100,${lat},${lon});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch('/api/overpass', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' }
    });

    if (!response.ok) return null;
    const data = await response.json();

    const context: NorthAmericaContext = { landmarks: [] };
    
    data.elements.forEach((el: any) => {
      if (el.tags) {
        if (el.tags.boundary === 'administrative') {
          if (el.tags.admin_level === '4') context.state = el.tags.name;
          if (el.tags.admin_level === '6') context.county = el.tags.name;
        } else if (el.tags.name) {
          const type = el.tags.tourism || el.tags.historic || el.tags.leisure || 'Landmark';
          context.landmarks.push({
            name: el.tags.name,
            type: type.charAt(0).toUpperCase() + type.slice(1),
            distance: 0
          });
        }
      }
    });

    context.landmarks = context.landmarks.slice(0, 5);
    return context;
  } catch (error) {
    console.error("Error fetching North America context:", error);
    return null;
  }
}

/**
 * Fetches US Census data (Tract/Block) if available.
 */
export async function fetchUSCensusData(lat: number, lon: number): Promise<any | null> {
  try {
    // US Census Geocoder API via Proxy
    const url = `/api/us-census?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const tracts = data.result?.geographies?.['Census Tracts'];
      if (tracts && tracts.length > 0) {
        return {
          tract: tracts[0].NAME,
          geoid: tracts[0].GEOID,
          source: 'US Census Bureau'
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetches detailed Canada address using StatCan/GeoGratis (Official Canada).
 */
export async function fetchCanadaOfficialAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/ca-statcan-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const res = data[0];
        return {
          label: res.title,
          province: res.province,
          source: 'Natural Resources Canada / StatCan'
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetches detailed Mexico address using INEGI (Official Mexico).
 */
export async function fetchMexicoOfficialAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/mx-inegi-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const res = data[0];
        return {
          label: res.Nombre,
          municipality: res.Municipio,
          state: res.Estado,
          source: 'INEGI (Official Mexico)'
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}
