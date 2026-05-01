export interface AddressField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

export interface LanguageFormat {
  name?: string;
  addressFormat: string;
  ordering: 'big-to-small' | 'small-to-big';
  fields: AddressField[];
}

export interface PostalCodeInfo {
  format: string;
  regex: string | null;
  api: string | null;
  source: string;
}

export interface AddressFormat {
  countryCode: string;
  name: string;
  // Enriched fields
  native?: LanguageFormat;
  english?: LanguageFormat;
  postalCode?: PostalCodeInfo;
  // Legacy fields (for compatibility during migration)
  nativeName?: string;
  addressFormat?: string;
  fields?: (AddressField & { labelEn?: string })[];
  ordering?: 'big-to-small' | 'small-to-big';
  postalCodeRegex?: string;
}

/**
 * Dynamically loads the address format for a given country code.
 * This improves initial loading speed by not bundling all formats at once.
 */
export async function getAddressFormat(countryCode: string): Promise<AddressFormat | null> {
  const code = countryCode.toUpperCase();
  try {
    // Vite handles dynamic imports with variables using glob patterns or specific paths
    // We use a switch or a map of dynamic imports for best compatibility and performance
    const format = await import(`./${code}.json`);
    return format.default as AddressFormat;
  } catch (error) {
    console.warn(`Address format for ${code} not found or failed to load.`);
    return null;
  }
}
