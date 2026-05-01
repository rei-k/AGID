
/**
 * Utility for converting WGS84 Lat/Lon to UK Ordnance Survey National Grid (OSGB36).
 * Based on the standard Airy 1830 ellipsoid and Transverse Mercator projection.
 */

export interface OSGridRef {
  eastings: number;
  northings: number;
  gridRef: string;
}

/**
 * Converts WGS84 coordinates to OSGB36 Eastings and Northings.
 * This is a simplified version suitable for general use.
 */
export function latLonToOSGrid(lat: number, lon: number): OSGridRef | null {
  // Only valid for UK region
  if (lat < 49 || lat > 61 || lon < -9 || lon > 2) return null;

  // Airy 1830 ellipsoid constants
  const a = 6377563.396;
  const b = 6356256.909;
  const F0 = 0.9996012717;
  const lat0 = 49 * Math.PI / 180;
  const lon0 = -2 * Math.PI / 180;
  const N0 = -100000;
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n * n * n;

  const phi = lat * Math.PI / 180;
  const lam = lon * Math.PI / 180;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const nu = a * F0 / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinPhi * sinPhi, 1.5);
  const eta2 = nu / rho - 1;

  const Ma = (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (phi - lat0);
  const Mb = (3 * n + 3 * n2 + (21 / 8) * n3) * Math.sin(phi - lat0) * Math.cos(phi + lat0);
  const Mc = ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * (phi - lat0)) * Math.cos(2 * (phi + lat0));
  const Md = (35 / 24) * n3 * Math.sin(3 * (phi - lat0)) * Math.cos(3 * (phi + lat0));
  const M = b * F0 * (Ma - Mb + Mc - Md);

  const I = M + N0;
  const II = (nu / 2) * sinPhi * cosPhi;
  const III = (nu / 24) * sinPhi * Math.pow(cosPhi, 3) * (5 - Math.pow(Math.tan(phi), 2) + 9 * eta2);
  const IIIA = (nu / 720) * sinPhi * Math.pow(cosPhi, 5) * (61 - 58 * Math.pow(Math.tan(phi), 2) + Math.pow(Math.tan(phi), 4));
  const IV = nu * cosPhi;
  const V = (nu / 6) * Math.pow(cosPhi, 3) * (nu / rho - Math.pow(Math.tan(phi), 2));
  const VI = (nu / 120) * Math.pow(cosPhi, 5) * (5 - 18 * Math.pow(Math.tan(phi), 2) + Math.pow(Math.tan(phi), 4) + 14 * eta2 - 58 * Math.pow(Math.tan(phi), 2) * eta2);

  const dLon = lam - lon0;
  const dLon2 = dLon * dLon;
  const dLon3 = dLon2 * dLon;
  const dLon4 = dLon3 * dLon;
  const dLon5 = dLon4 * dLon;
  const dLon6 = dLon5 * dLon;

  const N = I + II * dLon2 + III * dLon4 + IIIA * dLon6;
  const E = E0 + IV * dLon + V * dLon3 + VI * dLon5;

  return {
    eastings: Math.round(E),
    northings: Math.round(N),
    gridRef: formatGridRef(E, N)
  };
}

/**
 * Formats Eastings and Northings into a standard 6-figure grid reference (e.g., SU 123 456).
 */
function formatGridRef(E: number, N: number): string {
  if (E < 0 || E >= 700000 || N < 0 || N >= 1300000) return "";

  const gridChars = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  const e1 = Math.floor(E / 500000);
  const n1 = Math.floor(N / 500000);
  
  // First letter
  const tmp = e1 + n1 * 5;
  const f1 = 19 - Math.floor(tmp / 5) * 5 + (tmp % 5);
  const char1 = gridChars.charAt(f1 - 1); // This is a bit complex, using a simpler mapping for now
  
  // Standard OS Grid Letters mapping
  const l1 = Math.floor(E / 500000) + Math.floor(N / 500000) * 0.5; // Placeholder logic
  
  // Real OS Grid Letter Logic
  const eGrid = Math.floor(E / 100000);
  const nGrid = Math.floor(N / 100000);
  
  const grid1 = Math.floor(eGrid / 5) + Math.floor(nGrid / 5) * 5;
  const grid2 = (eGrid % 5) + (nGrid % 5) * 5;
  
  // Mapping for the two-letter prefix
  // This is a standard 100km square identification
  const letters = [
    ['SV','SW','SX','SY','SZ'],
    ['SQ','SR','SS','ST','SU'],
    ['SL','SM','SN','SO','SP'],
    ['SF','SG','SH','SJ','SK'],
    ['SA','SB','SC','SD','SE'],
    ['TV','TW','TX','TY','TZ'],
    ['TQ','TR','TS','TT','TU'],
    ['TL','TM','TN','TO','TP'],
    ['TF','TG','TH','TJ','TK'],
    ['TA','TB','TC','TD','TE'],
    ['OV','OW','OX','OY','OZ'],
    ['OQ','OR','OS','OT','OU'],
    ['OL','OM','ON','OO','OP'],
    ['OF','OG','OH','OJ','OK'],
    ['OA','OB','OC','OD','OE'],
    ['NV','NW','NX','NY','NZ'],
    ['NQ','NR','NS','NT','NU'],
    ['NL','NM','NN','NO','NP'],
    ['NF','NG','NH','NJ','NK'],
    ['NA','NB','NC','ND','NE'],
    ['HV','HW','HX','HY','HZ'],
    ['HQ','HR','HS','HT','HU'],
    ['HL','HM','HN','HO','HP'],
    ['HF','HG','HH','HJ','HK'],
    ['HA','HB','HC','HD','HE']
  ];

  // Correct index calculation for OSGB letters
  const col = Math.floor(E / 100000);
  const row = Math.floor(N / 100000);
  
  if (row < 0 || row >= letters.length || col < 0 || col >= 5) return `${Math.round(E)},${Math.round(N)}`;
  
  const prefix = letters[row][col];
  
  const e6 = Math.floor((E % 100000) / 100).toString().padStart(3, '0');
  const n6 = Math.floor((N % 100000) / 100).toString().padStart(3, '0');
  
  return `${prefix} ${e6} ${n6}`;
}
