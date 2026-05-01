/**
 * Service for fetching specialized address and postal information for Asia and Oceania countries.
 */

export interface AsiaOceaniaAddress {
  postcode?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
  suburb?: string;
  state?: string;
  label: string;
}

/**
 * Fetches detailed address for Asia and Oceania countries using the specialized proxy.
 */
export async function fetchAsiaOceaniaAddress(lat: number, lon: number, cc: string): Promise<AsiaOceaniaAddress | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

  try {
    const response = await fetch(`/api/asia-oceania-address?lat=${lat}&lon=${lon}&cc=${cc}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.village || data.address.city_district,
        street: data.address.road,
        houseNumber: data.address.house_number,
        suburb: data.address.suburb || data.address.neighbourhood,
        state: data.address.state || data.address.province || data.address.region,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Error fetching Asia/Oceania address (${cc}):`, error);
    return null;
  }
}

/**
 * Fetches detailed Japan address using Zipcloud API.
 */
export async function fetchJapanPostcode(postcode: string): Promise<any | null> {
  try {
    const response = await fetch(`/api/jp-postcode?zipcode=${postcode}`);
    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const res = data.results[0];
        return {
          address1: res.address1, // Prefecture
          address2: res.address2, // City/Ward
          address3: res.address3, // Town
          kana1: res.kana1,
          kana2: res.kana2,
          kana3: res.kana3,
          label: `${res.address1}${res.address2}${res.address3}`
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Japan postcode:", error);
    return null;
  }
}
