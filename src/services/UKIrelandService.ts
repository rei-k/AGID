
import { RegionalLandmark } from './SouthAsiaService';

export interface UKIrelandContext {
  landmarks: RegionalLandmark[];
  postcodeDetails?: any;
  osGridRef?: string;
}

/**
 * Fetches UK and Ireland specific context using Overpass API.
 * Focuses on cultural and historic landmarks: Castles, Pubs, Cathedrals, Stone Circles, etc.
 */
export async function fetchUKIrelandContext(lat: number, lon: number): Promise<UKIrelandContext | null> {
  const query = `
    [out:json][timeout:25];
    (
      node["historic"="castle"](around:20000, ${lat}, ${lon});
      way["historic"="castle"](around:20000, ${lat}, ${lon});
      node["amenity"="pub"](around:2000, ${lat}, ${lon});
      node["historic"="monument"](around:10000, ${lat}, ${lon});
      node["historic"="archaeological_site"](around:15000, ${lat}, ${lon});
      node["heritage"](around:15000, ${lat}, ${lon});
      node["tourism"="museum"](around:10000, ${lat}, ${lon});
      node["amenity"="place_of_worship"]["religion"="christian"](around:5000, ${lat}, ${lon});
      node["natural"="peak"](around:30000, ${lat}, ${lon});
      node["leisure"="nature_reserve"](around:20000, ${lat}, ${lon});
      node["tourism"="viewpoint"](around:10000, ${lat}, ${lon});
      // Ireland specific: Townlands and Ogham stones
      node["place"="townland"](around:5000, ${lat}, ${lon});
      node["historic"="ogham_stone"](around:20000, ${lat}, ${lon});
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
    const landmarks: RegionalLandmark[] = data.elements
      .filter((el: any) => el.tags && (el.tags.name || el.tags['name:en']))
      .map((el: any) => {
        let type = "Landmark";
        if (el.tags.historic === "castle") type = "Castle";
        else if (el.tags.amenity === "pub") type = "Traditional Pub";
        else if (el.tags.historic === "monument") type = "Monument";
        else if (el.tags.historic === "archaeological_site") type = "Archaeological Site";
        else if (el.tags.tourism === "museum") type = "Museum";
        else if (el.tags.amenity === "place_of_worship") type = "Church/Cathedral";
        else if (el.tags.natural === "peak") type = "Peak/Hill";
        else if (el.tags.leisure === "nature_reserve") type = "Nature Reserve";
        else if (el.tags.tourism === "viewpoint") type = "Viewpoint";
        else if (el.tags.place === "townland") type = "Irish Townland";
        else if (el.tags.historic === "ogham_stone") type = "Ogham Stone";

        const eLat = el.lat || el.center?.lat || lat;
        const eLon = el.lon || el.center?.lon || lon;
        const dLat = eLat - lat;
        const dLon = eLon - lon;
        const distance = Math.sqrt(dLat * dLat + dLon * dLon) * 111;

        return {
          type,
          name: el.tags.name || el.tags['name:en'],
          distance: Math.round(distance * 10) / 10
        };
      })
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, 8);

    return { landmarks };
  } catch (error) {
    console.error("Error fetching UK/Ireland context:", error);
    return null;
  }
}

/**
 * Fetches detailed UK postcode information from postcodes.io via server proxy.
 */
export async function fetchUKPostcodeDetails(postcode: string): Promise<any | null> {
  if (!postcode) return null;
  
  try {
    const response = await fetch(`/api/uk-postcode/${encodeURIComponent(postcode.replace(/\s/g, ''))}`);
    if (response.ok) {
      const data = await response.json();
      return data.result || null;
    }
    return null;
  } catch (error) {
    console.error("Error fetching UK postcode details:", error);
    return null;
  }
}
