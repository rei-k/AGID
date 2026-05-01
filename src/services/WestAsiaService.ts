
/**
 * West Asia Regional Context Service
 * Fetches regional-specific landmarks and features using Overpass API.
 */

export interface RegionalLandmark {
  name: string;
  type: string;
  distance: number;
}

export async function fetchWestAsiaContext(lat: number, lon: number): Promise<RegionalLandmark[]> {
  // Query for Mosques, Souks, Wadis, Oases, and Historic sites common in West Asia
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="place_of_worship"]["religion"="muslim"](around:2000,${lat},${lon});
      node["shop"="marketplace"](around:2000,${lat},${lon});
      node["historic"](around:2000,${lat},${lon});
      node["natural"="wadi"](around:5000,${lat},${lon});
      node["natural"="oasis"](around:5000,${lat},${lon});
      way["amenity"="place_of_worship"]["religion"="muslim"](around:2000,${lat},${lon});
      way["shop"="marketplace"](around:2000,${lat},${lon});
      way["historic"](around:2000,${lat},${lon});
    );
    out center;
  `;

  try {
    const response = await fetch('/api/overpass', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' }
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!data.elements) return [];

    return data.elements.map((el: any) => {
      const eLat = el.lat || el.center?.lat;
      const eLon = el.lon || el.center?.lon;
      const dist = calculateDistance(lat, lon, eLat, eLon);
      
      let type = "Landmark";
      if (el.tags.amenity === 'place_of_worship') type = "Mosque";
      else if (el.tags.shop === 'marketplace') type = "Souk/Market";
      else if (el.tags.historic) type = "Historic Site";
      else if (el.tags.natural === 'wadi') type = "Wadi";
      else if (el.tags.natural === 'oasis') type = "Oasis";

      return {
        name: el.tags.name || el.tags['name:en'] || "Unnamed Feature",
        type,
        distance: Math.round(dist)
      };
    }).sort((a: any, b: any) => a.distance - b.distance).slice(0, 3);

  } catch (error) {
    console.error("West Asia Context Error:", error);
    return [];
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}
