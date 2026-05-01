
export interface RegionalLandmark {
  type: string;
  name: string;
  distance: number;
}

export interface SouthAsiaContext {
  landmarks: RegionalLandmark[];
}

export async function fetchSouthAsiaContext(lat: number, lon: number): Promise<SouthAsiaContext | null> {
  // Landmarks: Temple, Stupa, Fort, Ghat, Mosque, Historic Site, Peak, River
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="place_of_worship"]["religion"="hindu"](around:10000, ${lat}, ${lon});
      node["amenity"="place_of_worship"]["religion"="buddhist"](around:15000, ${lat}, ${lon});
      node["amenity"="place_of_worship"]["religion"="muslim"](around:10000, ${lat}, ${lon});
      node["historic"="fort"](around:30000, ${lat}, ${lon});
      way["historic"="fort"](around:30000, ${lat}, ${lon});
      node["historic"="monument"](around:10000, ${lat}, ${lon});
      node["historic"="archaeological_site"](around:30000, ${lat}, ${lon});
      node["natural"="peak"](around:50000, ${lat}, ${lon});
      node["waterway"="river"](around:20000, ${lat}, ${lon});
      node["railway"="station"](around:20000, ${lat}, ${lon});
      node["tourism"="heritage"](around:20000, ${lat}, ${lon});
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
        if (el.tags.religion === "hindu") type = "Hindu Temple";
        else if (el.tags.religion === "buddhist") type = "Buddhist Stupa/Temple";
        else if (el.tags.religion === "muslim") type = "Mosque";
        else if (el.tags.historic === "fort") type = "Fort";
        else if (el.tags.historic === "monument") type = "Monument";
        else if (el.tags.historic === "archaeological_site") type = "Historic Site";
        else if (el.tags.natural === "peak") type = "Mountain Peak";
        else if (el.tags.waterway === "river") type = "River";
        else if (el.tags.railway === "station") type = "Railway Station";
        else if (el.tags.tourism === "heritage") type = "Heritage Site";

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
      .slice(0, 5);

    return { landmarks };
  } catch (error) {
    console.error("Error fetching South Asia context:", error);
    return null;
  }
}
