
export interface RegionalLandmark {
  type: string;
  name: string;
  distance: number;
}

export interface RussiaContext {
  landmarks: RegionalLandmark[];
}

export async function fetchRussiaContext(lat: number, lon: number): Promise<RussiaContext | null> {
  const query = `
    [out:json][timeout:25];
    (
      node["historic"="kremlin"](around:50000, ${lat}, ${lon});
      way["historic"="kremlin"](around:50000, ${lat}, ${lon});
      node["amenity"="place_of_worship"]["religion"="christian"]["denomination"="orthodox"](around:20000, ${lat}, ${lon});
      node["historic"="monument"](around:10000, ${lat}, ${lon});
      node["historic"="memorial"](around:10000, ${lat}, ${lon});
      node["tourism"="museum"](around:20000, ${lat}, ${lon});
      node["railway"="station"](around:30000, ${lat}, ${lon});
      node["natural"="water"](around:50000, ${lat}, ${lon});
      node["natural"="peak"](around:50000, ${lat}, ${lon});
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
        if (el.tags.historic === "kremlin") type = "Kremlin";
        else if (el.tags.religion === "christian") type = "Orthodox Church";
        else if (el.tags.historic === "monument") type = "Monument";
        else if (el.tags.historic === "memorial") type = "Memorial";
        else if (el.tags.tourism === "museum") type = "Museum";
        else if (el.tags.railway === "station") type = "Railway Station";
        else if (el.tags.natural === "water") type = "Water Body";
        else if (el.tags.natural === "peak") type = "Mountain Peak";

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
    console.error("Error fetching Russia context:", error);
    return null;
  }
}
