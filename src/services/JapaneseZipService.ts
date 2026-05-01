
/**
 * Service for Japanese Postcode (Zip Code) lookup.
 * Uses the ZipCloud API (https://zipcloud.ibsnet.co.jp/api/search)
 */

export interface ZipResult {
  address1: string; // Prefecture (e.g., 東京都)
  address2: string; // City (e.g., 千代田区)
  address3: string; // Town (e.g., 永田町)
  kana1: string;
  kana2: string;
  kana3: string;
  prefcode: string;
  zipcode: string;
}

export async function lookupJapaneseZip(zipcode: string): Promise<ZipResult | null> {
  // Remove hyphens
  const cleanZip = zipcode.replace(/[^\d]/g, '');
  
  if (cleanZip.length !== 7) {
    return null;
  }

  try {
    // Using a proxy if needed, but zipcloud supports CORS
    const response = await fetch(`/api/jp-postcode?zipcode=${cleanZip}`);
    if (!response.ok) throw new Error('ZipCloud API error');
    
    const data = await response.json();
    
    if (data.status === 200 && data.results && data.results.length > 0) {
      return data.results[0];
    }
    
    return null;
  } catch (error) {
    console.error('Japanese Zip Lookup Error:', error);
    return null;
  }
}
