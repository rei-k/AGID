/**
 * Navigation utilities for maritime and aviation.
 */

/**
 * Calculates the distance between two points using the Haversine formula.
 * @returns Distance in kilometers.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the initial bearing from one point to another.
 * @returns Bearing in degrees (0-360).
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * (Math.PI / 180);
  const φ2 = lat2 * (Math.PI / 180);
  const Δλ = (lon2 - lon1) * (Math.PI / 180);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;
  return bearing;
}

/**
 * Converts kilometers to nautical miles.
 */
export function kmToNm(km: number): number {
  return km / 1.852;
}

/**
 * Formats distance based on unit system.
 */
export function formatDistance(km: number, unit: 'metric' | 'nautical' | 'automatic' | 'kilometers' | 'miles'): string {
  if (unit === 'nautical') {
    const nm = kmToNm(km);
    return nm.toFixed(2) + ' NM';
  }
  if (unit === 'miles') {
    const miles = km * 0.621371;
    return miles.toFixed(2) + ' mi';
  }
  if (unit === 'kilometers') {
    return km.toFixed(2) + ' km';
  }
  // Default or 'automatic'
  // For now, automatic defaults to metric (km)
  return km.toFixed(2) + ' km';
}
