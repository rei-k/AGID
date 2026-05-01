
export interface AOIDData {
  id: string; // 9-character base32
  name: string;
  phone: string;
  address: string;
  building?: string;
  room?: string;
  agid?: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

/**
 * Generates a unique 9-character base32 ID for AOID.
 * Uses a simplified approach avoiding I, L, O to prevent reading errors.
 */
export function generateAOID(): string {
  const charset = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Standard Base32 excluding ambiguous chars
  let result = '';
  // Use crypto for better uniqueness
  const randomValues = new Uint32Array(9);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < 9; i++) {
    result += charset.charAt(randomValues[i] % charset.length);
  }
  return result;
}
