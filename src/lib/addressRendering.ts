
import { transliterate } from './transliteration';
import { applyShippingAbbreviations } from './addressUtils';

export interface CanonicalAddress {
  country_code: string;
  country: string;
  state: string;
  city: string;
  district: string;
  subdistrict: string;
  suburb: string;
  road: string;
  house_number: string;
  building: string;
  postcode: string;
  poi: string;
}

/**
 * Unicode Normalization for Addresses
 */
export function normalizeUnicode(text: string): string {
  if (!text) return "";
  return text
    .normalize('NFKC') // Compatibility Decomposition, then Canonical Composition (handles fullwidth etc)
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[\u3000\s]+/g, " ")
    .trim();
}

/**
 * Creates a Canonical Address object from raw API details
 */
export function createCanonicalAddress(details: any): CanonicalAddress {
  return {
    country_code: (details.country_code || "").toUpperCase(),
    country: details.country || "",
    state: details.state || details.province || details.region || "",
    city: details.city || details.town || details.village || "",
    district: details.city_district || details.district || details.county || "",
    subdistrict: details.subdistrict || details.suburb || details.neighbourhood || "",
    suburb: details.suburb || details.hamlet || "",
    road: details.road || details.street || "",
    house_number: details.house_number || "",
    building: details.building || details.organization || "",
    postcode: details.postcode || "",
    poi: details.amenity || details.shop || details.tourism || ""
  };
}

/**
 * Address Rendering Engine for International Shipping
 */
export class AddressRenderer {
  
  /**
   * Main entry point for rendering an address based on specific tab/context
   */
  static render(tab: string, data: CanonicalAddress): string {
    const canonical = this.normalizeCanonical(data);
    
    // Check if it's the specialized International English tab
    if (tab === 'intl_en') {
      return this.renderInternationalEnglish(canonical);
    }
    
    // Otherwise render by language code
    return this.renderByLanguage(tab, canonical);
  }

  private static normalizeCanonical(data: CanonicalAddress): CanonicalAddress {
    const result = { ...data };
    Object.keys(result).forEach(key => {
      const k = key as keyof CanonicalAddress;
      if (typeof result[k] === 'string') {
        result[k] = normalizeUnicode(result[k] as string);
      }
    });
    return result;
  }

  /**
   * Renders address based on the specified language code
   */
  private static renderByLanguage(lang: string, data: CanonicalAddress): string {
    const isEastAsian = ['JP', 'CN', 'TW', 'HK', 'MO', 'KR', 'KP', 'VN', 'HU'].includes(data.country_code);
    const isEnglish = lang.startsWith('en');
    
    // If it's English domestic (inside an English country)
    if (isEnglish && ['US', 'GB', 'CA', 'AU', 'NZ', 'IE'].includes(data.country_code)) {
      return this.renderDomesticEnglish(data);
    }

    if (isEastAsian && !isEnglish) {
      // Big-to-Small for East Asian languages
      const parts = [
        data.postcode ? `〒${data.postcode}` : "",
        data.state,
        data.city,
        data.district,
        data.subdistrict,
        data.road,
        data.house_number,
        data.building
      ].filter(Boolean);
      return parts.join(data.country_code === 'JP' ? "" : " ");
    } else {
      // Small-to-Big for others
      const isRoadFirst = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI'].includes(data.country_code);
      const t = (val: string) => isEnglish ? (val ? transliterate(val, data.country_code.toLowerCase()) : "") : val;

      const line1 = isRoadFirst 
        ? `${t(data.road)} ${t(data.house_number)}`.trim()
        : `${t(data.house_number)} ${t(data.road)}`.trim();

      const parts = [
        t(data.building),
        line1,
        t(data.subdistrict),
        t(data.city),
        t(data.state),
        data.postcode
      ].filter(Boolean);
      
      // Don't include country name in domestic view (except maybe for English intl)
      return parts.join(", ");
    }
  }

  /**
   * Standard English formatting for domestic use
   */
  private static renderDomesticEnglish(data: CanonicalAddress): string {
    const t = (val: string) => val ? transliterate(val, data.country_code.toLowerCase()) : "";
    const parts = [
      t(data.building),
      `${t(data.house_number)} ${t(data.road)}`.trim(),
      t(data.subdistrict),
      t(data.city),
      t(data.state),
      data.postcode
    ].filter(Boolean);
    return parts.join(", ");
  }

  /**
   * International standard English (Small-to-Big, ASCII, Capitalized Country)
   */
  private static renderInternationalEnglish(data: CanonicalAddress): string {
    const t = (val: string) => val ? transliterate(val, data.country_code.toLowerCase()) : "";
    const parts = [
      t(data.building),
      `${t(data.house_number)} ${t(data.road)}`.trim(),
      t(data.subdistrict),
      t(data.city),
      t(data.state),
      data.postcode,
      data.country.toUpperCase()
    ].filter(Boolean);

    let text = parts.join(", ").replace(/,\s*,/g, ',');
    // Strip non-ASCII for international compliance
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\x7F]/g, "");
  }

  static renderCarrier(data: CanonicalAddress): string {
    const canonical = this.normalizeCanonical(data);
    let text = this.renderInternationalEnglish(canonical);
    text = applyShippingAbbreviations(text);
    return text.toUpperCase();
  }
}
