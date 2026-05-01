/**
 * Service for fetching regional context for the Caribbean.
 */

export interface CaribbeanContext {
  island?: string;
  parish?: string;
  district?: string;
  landmarks: {
    name: string;
    type: string;
    distance: number;
  }[];
}

/**
 * Fetches regional context for the Caribbean using Overpass API.
 */
export async function fetchCaribbeanContext(lat: number, lon: number, cc: string): Promise<CaribbeanContext | null> {
  const radius = 3000;
  
  // Query for islands, beaches, resorts, and administrative boundaries (Parish/District)
  const query = `
    [out:json][timeout:25];
    (
      node["place"="island"](around:${radius*5},${lat},${lon});
      node["natural"="beach"](around:${radius},${lat},${lon});
      node["tourism"~"resort|hotel"](around:${radius},${lat},${lon});
      way["boundary"="administrative"]["admin_level"~"4|6|8"](around:200,${lat},${lon});
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

    const context: CaribbeanContext = { landmarks: [] };
    
    data.elements.forEach((el: any) => {
      if (el.tags) {
        if (el.tags.place === 'island') {
          context.island = el.tags.name;
        } else if (el.tags.boundary === 'administrative') {
          // Many Caribbean countries use Parish (admin_level 6 or 4)
          if (el.tags.admin_level === '6' || el.tags.admin_level === '4') {
            context.parish = el.tags.name;
          }
          if (el.tags.admin_level === '8') {
            context.district = el.tags.name;
          }
        } else if (el.tags.name) {
          const type = el.tags.natural || el.tags.tourism || 'Landmark';
          context.landmarks.push({
            name: el.tags.name,
            type: type.charAt(0).toUpperCase() + type.slice(1),
            distance: 0
          });
        }
      }
    });

    context.landmarks = context.landmarks.slice(0, 6);
    return context;
  } catch (error) {
    console.error("Error fetching Caribbean context:", error);
    return null;
  }
}

/**
 * Fetches Caribbean specific address details if available.
 */
export async function fetchCaribbeanOfficialAddress(lat: number, lon: number, cc: string): Promise<any | null> {
  // For Puerto Rico, we already use US Census.
  // For others, we can use specialized Nominatim queries or local open data if available.
  // Many Caribbean countries rely on descriptive addresses.
  
  try {
    // Placeholder for future official Caribbean APIs (e.g. ONE for Dominican Republic)
    if (cc === 'do') {
      // Dominican Republic ONE pattern (simulated via specialized Nominatim for now)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=es`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.province || data.address.state,
          municipality: data.address.city || data.address.town,
          source: 'ONE / Nominatim (Dominican Republic)'
        };
      }
    }
    
    if (cc === 'jm') {
      // Jamaica specialized
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          parish: data.address.state || data.address.county,
          source: 'NLA / Nominatim (Jamaica)'
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
