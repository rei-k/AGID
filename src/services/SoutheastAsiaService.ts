/**
 * Service for fetching regional context for Southeast Asia.
 */

export interface SoutheastAsiaContext {
  province?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  landmarks: {
    name: string;
    type: string;
    distance: number;
  }[];
}

/**
 * Fetches regional context for Southeast Asia using Overpass API.
 */
export async function fetchSoutheastAsiaContext(lat: number, lon: number, cc: string): Promise<SoutheastAsiaContext | null> {
  const radius = 2000;
  
  // Query for administrative boundaries (Province, City/Regency, District) and landmarks
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"](around:${radius},${lat},${lon});
      node["historic"](around:${radius},${lat},${lon});
      node["amenity"~"place_of_worship|market"](around:${radius},${lat},${lon});
      way["boundary"="administrative"]["admin_level"~"4|5|6|7|8"](around:150,${lat},${lon});
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

    const context: SoutheastAsiaContext = { landmarks: [] };
    
    data.elements.forEach((el: any) => {
      if (el.tags) {
        if (el.tags.boundary === 'administrative') {
          // Admin level mapping varies by country in SEA
          if (el.tags.admin_level === '4') context.province = el.tags.name;
          if (el.tags.admin_level === '5' || el.tags.admin_level === '6') context.city = el.tags.name;
          if (el.tags.admin_level === '7') context.district = el.tags.name;
          if (el.tags.admin_level === '8') context.subdistrict = el.tags.name;
        } else if (el.tags.name) {
          const type = el.tags.tourism || el.tags.historic || el.tags.amenity || 'Landmark';
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
    console.error("Error fetching Southeast Asia context:", error);
    return null;
  }
}

/**
 * Fetches Southeast Asia specific official address details if available.
 */
export async function fetchSoutheastAsiaOfficialAddress(lat: number, lon: number, cc: string): Promise<any | null> {
  try {
    // Specialized queries for Southeast Asian countries
    if (cc === 'th') {
      // Thailand specialized
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=th,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.province || data.address.state,
          district: data.address.city_district || data.address.county || data.address.district,
          subdistrict: data.address.suburb || data.address.village || data.address.subdistrict,
          source: 'OpenData TH / Nominatim (Thailand)'
        };
      }
    }
    
    if (cc === 'id') {
      // Indonesia specialized (BPS/BIG standards)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=id,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          regency: data.address.city || data.address.county || data.address.regency,
          district: data.address.city_district || data.address.suburb || data.address.district,
          source: 'BIG / Nominatim (Indonesia)'
        };
      }
    }

    if (cc === 'vn') {
      // Vietnam specialized
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=vi,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state || data.address.province,
          district: data.address.city || data.address.county || data.address.district,
          ward: data.address.suburb || data.address.neighbourhood || data.address.ward,
          source: 'VNM / Nominatim (Vietnam)'
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
