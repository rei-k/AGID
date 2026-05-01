
export interface RegionalLandmark {
  type: string;
  name: string;
  distance: number;
}

export interface CentralAsiaContext {
  landmarks: RegionalLandmark[];
}

export async function fetchCentralAsiaContext(lat: number, lon: number): Promise<CentralAsiaContext | null> {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="place_of_worship"]["religion"="muslim"](around:15000, ${lat}, ${lon});
      node["historic"="archaeological_site"](around:40000, ${lat}, ${lon});
      node["historic"="mausoleum"](around:30000, ${lat}, ${lon});
      node["tourism"="caravanserai"](around:50000, ${lat}, ${lon});
      node["historic"="monument"](around:10000, ${lat}, ${lon});
      node["natural"="peak"](around:50000, ${lat}, ${lon});
      node["natural"="water"](around:50000, ${lat}, ${lon});
      node["place"="village"](around:20000, ${lat}, ${lon});
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
        if (el.tags.religion === "muslim") type = "Mosque/Madrasa";
        else if (el.tags.historic === "mausoleum") type = "Mausoleum";
        else if (el.tags.historic === "archaeological_site") type = "Historic Site";
        else if (el.tags.tourism === "caravanserai") type = "Caravanserai";
        else if (el.tags.historic === "monument") type = "Monument";
        else if (el.tags.natural === "peak") type = "Mountain Peak";
        else if (el.tags.natural === "water") type = "Water Body";
        else if (el.tags.place === "village") type = "Village";

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
    console.error("Error fetching Central Asia context:", error);
    return null;
  }
}
