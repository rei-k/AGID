/**
 * Service for fetching regional context for Central America.
 */

export interface CentralAmericaContext {
  department?: string;
  municipality?: string;
  district?: string;
  landmarks: {
    name: string;
    type: string;
    distance: number;
  }[];
}

/**
 * Fetches regional context for Central America using Overpass API.
 */
export async function fetchCentralAmericaContext(lat: number, lon: number, cc: string): Promise<CentralAmericaContext | null> {
  const radius = 2500;
  
  // Query for administrative boundaries (Department/Province, Municipality) and landmarks
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"](around:${radius},${lat},${lon});
      node["historic"](around:${radius},${lat},${lon});
      node["leisure"="park"](around:${radius},${lat},${lon});
      way["boundary"="administrative"]["admin_level"~"4|6|8"](around:150,${lat},${lon});
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

    const context: CentralAmericaContext = { landmarks: [] };
    
    data.elements.forEach((el: any) => {
      if (el.tags) {
        if (el.tags.boundary === 'administrative') {
          // Admin level 4 is usually Department/Province
          if (el.tags.admin_level === '4') {
            context.department = el.tags.name;
          }
          // Admin level 6 is usually Municipality
          if (el.tags.admin_level === '6') {
            context.municipality = el.tags.name;
          }
          // Admin level 8 is usually District/Barrio
          if (el.tags.admin_level === '8') {
            context.district = el.tags.name;
          }
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
    console.error("Error fetching Central America context:", error);
    return null;
  }
}

/**
 * Fetches Central America specific official address details if available.
 */
export async function fetchCentralAmericaOfficialAddress(lat: number, lon: number, cc: string): Promise<any | null> {
  try {
    // Specialized queries for Central American countries
    if (cc === 'cr') {
      // Costa Rica SNIT pattern (simulated via specialized Nominatim for now)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=es`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.province || data.address.state,
          canton: data.address.county,
          district: data.address.suburb || data.address.neighbourhood,
          source: 'SNIT / Nominatim (Costa Rica)'
        };
      }
    }
    
    if (cc === 'pa') {
      // Panama INEC pattern
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=es`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.province || data.address.state,
          district: data.address.city || data.address.town,
          corregimiento: data.address.suburb,
          source: 'INEC / Nominatim (Panama)'
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
