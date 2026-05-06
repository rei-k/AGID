
/**
 * Africa-specific geocoding and geographic data services.
 */

export interface AfricaContext {
  region: string;
  subRegion?: string;
  isSahara?: boolean;
  isSahel?: boolean;
  isSubSaharan?: boolean;
  isNileValley?: boolean;
  isRiftValley?: boolean;
  localTime?: string;
  majorCitiesNear?: string[];
  climateZone?: string;
}

/**
 * Fetches geographic context for a point in Africa.
 */
export async function fetchAfricaContext(lat: number, lon: number, countryCode: string): Promise<AfricaContext | null> {
  const isSahara = lat > 18 && lat < 30 && lon > -15 && lon < 35;
  const isSahel = lat > 12 && lat <= 18 && lon > -15 && lon < 35;
  const isSubSaharan = lat <= 15;
  const isNileValley = lon > 30 && lon < 33 && lat > 15 && lat < 31;
  const isRiftValley = lon > 34 && lon < 37 && lat > -15 && lat < 5;

  let region = "Africa";
  if (lat > 20) region = "Northern Africa";
  else if (lat < -10) region = "Southern Africa";
  else if (lon < 10) region = "Western Africa";
  else if (lon > 40) region = "Eastern Africa";
  else region = "Central Africa";

  return {
    region,
    isSahara,
    isSahel,
    isSubSaharan,
    isNileValley,
    isRiftValley,
    climateZone: isSahara ? "Desert" : isSahel ? "Semi-arid" : "Tropical/Subtropical"
  };
}

/**
 * Interface for African official address results
 */
export async function fetchAfricaOfficialAddress(lat: number, lon: number, countryCode: string): Promise<any | null> {
  if (countryCode === 'za') return fetchSouthAfricaAddress(lat, lon);
  if (countryCode === 'eg') return fetchEgyptAddress(lat, lon);
  return null;
}

/**
 * Fetches South African address details via proxy.
 */
export async function fetchSouthAfricaAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/za-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.suburb,
        street: data.address.road,
        houseNumber: data.address.house_number,
        province: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching South African address:", error);
    return null;
  }
}

/**
 * Fetches Egyptian address details via proxy.
 */
export async function fetchEgyptAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/eg-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.governorate,
        street: data.address.road,
        houseNumber: data.address.house_number,
        governorate: data.address.state || data.address.governorate,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Egyptian address:", error);
    return null;
  }
}
