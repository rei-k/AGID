
import africaData from '../data/africa_regions.json';
import americasData from '../data/americas_regions.json';
import asiaData from '../data/asia_regions.json';
import caribbeanData from '../data/caribbean_regions.json';
import europeData from '../data/europe_regions.json';
import oceaniaData from '../data/oceania_regions.json';
import southAmericaData from '../data/south_america_regions.json';
import disputedTerritoriesData from '../data/disputed_territories.json';
import seasData from '../data/seas.json';

/**
 * AGID Geographic Region Data
 * Consolidated from partitioned JSON sources for modularity and efficiency.
 */

export interface GeoRegion {
  id?: string;
  code?: string;
  name: string;
  n: number;
  s: number;
  w: number;
  e: number;
  polygon?: any;
}

// Helper to flatten continent data which is organized by sub-regions
const flattenContinent = (data: any): GeoRegion[] => {
  return Object.values(data).flat() as GeoRegion[];
};

export const SEA_REGIONS = seasData as GeoRegion[];

export const LAND_REGIONS: GeoRegion[] = [
  { id: "AF", n: 37.5, s: -35, w: -18, e: 51.5, name: "Africa" },
  { id: "AQ", n: -60, s: -90, w: -180, e: 180, name: "Antarctica" },
  { id: "AS", n: 77.5, s: -11, w: 26, e: 180, name: "Asia" },
  { id: "EU", n: 71.5, s: 35, w: -25, e: 60, name: "Europe" },
  { id: "NA", n: 83.5, s: 7, w: -168, e: -52, name: "North America" },
  { id: "SA", n: 13, s: -56, w: -82, e: -34, name: "South America" },
  { id: "OC", n: 30, s: -55, w: 110, e: -120, name: "Oceania" },
];

export const COUNTRY_REGIONS: GeoRegion[] = [
  ...flattenContinent(africaData),
  ...flattenContinent(americasData),
  ...flattenContinent(asiaData),
  ...flattenContinent(caribbeanData),
  ...flattenContinent(europeData),
  ...flattenContinent(oceaniaData),
  ...flattenContinent(southAmericaData),
  ...(disputedTerritoriesData as GeoRegion[])
];
