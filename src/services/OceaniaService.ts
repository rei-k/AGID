/**
 * Service for fetching regional context for Australia and New Zealand.
 */

export interface OceaniaContext {
  state?: string;
  lga?: string; // Local Government Area (AU)
  district?: string; // (NZ)
  landmarks: {
    name: string;
    type: string;
    distance: number;
  }[];
}

/**
 * Fetches regional context for Australia or New Zealand using Overpass API.
 */
export async function fetchOceaniaContext(lat: number, lon: number, cc: string): Promise<OceaniaContext | null> {
  const radius = 2000;
  // Query for administrative boundaries and landmarks
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"](around:${radius},${lat},${lon});
      node["historic"](around:${radius},${lat},${lon});
      node["natural"="peak"](around:${radius},${lat},${lon});
      way["boundary"="administrative"]["admin_level"~"4|6|8"](around:100,${lat},${lon});
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

    const context: OceaniaContext = { landmarks: [] };
    
    data.elements.forEach((el: any) => {
      if (el.tags) {
        if (el.tags.boundary === 'administrative') {
          if (el.tags.admin_level === '4') context.state = el.tags.name;
          if (cc === 'au' && el.tags.admin_level === '6') context.lga = el.tags.name;
          if (cc === 'nz' && el.tags.admin_level === '6') context.district = el.tags.name;
        } else if (el.tags.name) {
          const type = el.tags.tourism || el.tags.historic || el.tags.natural || 'Landmark';
          context.landmarks.push({
            name: el.tags.name,
            type: type.charAt(0).toUpperCase() + type.slice(1),
            distance: 0 // Distance calculation could be added if needed
          });
        }
      }
    });

    // Limit landmarks
    context.landmarks = context.landmarks.slice(0, 5);
    return context;
  } catch (error) {
    console.error("Error fetching Oceania context:", error);
    return null;
  }
}
