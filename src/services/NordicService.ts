
import { RegionalLandmark } from './SouthAsiaService';

export interface NordicContext {
  landmarks: RegionalLandmark[];
  weather?: {
    temp: number;
    symbol: string;
    description: string;
    windSpeed: number;
  };
  addressDetails?: {
    postcode?: string;
    city?: string;
    street?: string;
    houseNumber?: string;
    municipality?: string;
    county?: string;
    source?: string;
  };
}

/**
 * Fetches Nordic specific context using Overpass API.
 * Focuses on Nordic features: Fjords, Viking sites, Stave churches, Saunas, National Parks.
 */
export async function fetchNordicContext(lat: number, lon: number): Promise<NordicContext | null> {
  const query = `
    [out:json][timeout:25];
    (
      node["historic"="viking_site"](around:50000, ${lat}, ${lon});
      node["historic"="stave_church"](around:50000, ${lat}, ${lon});
      node["amenity"="sauna"](around:5000, ${lat}, ${lon});
      node["natural"="fjord"](around:50000, ${lat}, ${lon});
      node["leisure"="nature_reserve"](around:30000, ${lat}, ${lon});
      node["boundary"="national_park"](around:50000, ${lat}, ${lon});
      node["tourism"="viewpoint"](around:15000, ${lat}, ${lon});
      node["natural"="peak"](around:30000, ${lat}, ${lon});
      node["historic"="monument"](around:15000, ${lat}, ${lon});
      node["tourism"="museum"](around:10000, ${lat}, ${lon});
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
        if (el.tags.historic === "viking_site") type = "Viking Site";
        else if (el.tags.historic === "stave_church") type = "Stave Church";
        else if (el.tags.amenity === "sauna") type = "Sauna";
        else if (el.tags.natural === "fjord") type = "Fjord";
        else if (el.tags.leisure === "nature_reserve") type = "Nature Reserve";
        else if (el.tags.boundary === "national_park") type = "National Park";
        else if (el.tags.tourism === "viewpoint") type = "Viewpoint";
        else if (el.tags.natural === "peak") type = "Peak";
        else if (el.tags.historic === "monument") type = "Monument";
        else if (el.tags.tourism === "museum") type = "Museum";

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
    console.error("Error fetching Nordic context:", error);
    return null;
  }
}

/**
 * Fetches Nordic weather data from Met.no via server proxy.
 */
export async function fetchNordicWeather(lat: number, lon: number): Promise<NordicContext['weather'] | null> {
  try {
    const response = await fetch(`/api/nordic/weather?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      const current = data.properties.timeseries[0].data.instant.details;
      const nextHour = data.properties.timeseries[0].data.next_1_hours;
      
      return {
        temp: current.air_temperature,
        symbol: nextHour?.summary?.symbol_code || 'unknown',
        description: nextHour?.summary?.symbol_code?.replace(/_/g, ' ') || 'Clear',
        windSpeed: current.wind_speed
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Nordic weather:", error);
    return null;
  }
}

/**
 * Fetches detailed Danish address from DAWA.
 */
export async function fetchDanishAddress(lat: number, lon: number): Promise<NordicContext['addressDetails'] | null> {
  try {
    const response = await fetch(`/api/dk-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.postnr,
        city: data.postnrnavn,
        street: data.vejnavn,
        houseNumber: data.husnr,
        municipality: data.kommune?.navn,
        source: 'DAWA'
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Danish address:", error);
    return null;
  }
}

/**
 * Fetches detailed Norwegian address from Kartverket.
 */
export async function fetchNorwegianAddress(lat: number, lon: number): Promise<NordicContext['addressDetails'] | null> {
  try {
    const response = await fetch(`/api/no-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data.adresser && data.adresser.length > 0) {
        const addr = data.adresser[0];
        return {
          postcode: addr.postnummer,
          city: addr.poststed,
          street: addr.adressenavn,
          houseNumber: addr.nummer,
          municipality: addr.kommunenavn,
          county: addr.fylkesnavn,
          source: 'Kartverket'
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Norwegian address:", error);
    return null;
  }
}

/**
 * Fetches detailed Finnish address from Digitransit.
 */
export async function fetchFinnishAddress(lat: number, lon: number): Promise<NordicContext['addressDetails'] | null> {
  try {
    const response = await fetch(`/api/fi-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const props = data.features[0].properties;
        return {
          postcode: props.postalcode,
          city: props.locality,
          street: props.street,
          houseNumber: props.housenumber,
          municipality: props.localadmin,
          county: props.region,
          source: 'Digitransit'
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Finnish address:", error);
    return null;
  }
}
