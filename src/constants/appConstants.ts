import { Globe, ShieldCheck, AlertOctagon } from 'lucide-react';

export const RESOURCE_CATEGORIES = [
  {
    title: "1. AGID Prefix System (Regularity)",
    items: [
      { name: "Land: [Alpha-2]", desc: "2-char Country Code (ISO 3166-1)", features: "JP, US, FR, etc." },
      { name: "Sea: [IHO-Code]", desc: "4-char IHO S-23 Sea Area Code", features: "NPAC, NATL, MEDT, SJPN, etc." },
      { name: "Fallback: [Continent]", desc: "2-char Continent Code for Land", features: "AS, EU, NA, AF, etc." }
    ]
  },
  {
    title: "2. Hash Calculation (Deterministic)",
    items: [
      { name: "Grid Size: 4m", desc: "High-precision 4x4m grid cells", features: "O(1) calculation" },
      { name: "Base32 Encoding", desc: "Human-readable hash (excluding I, L, O, 0, 1)", features: "8-10 chars" }
    ]
  },
  {
    title: "3. Reference Standards",
    items: [
      { name: "IHO S-23", desc: "Limits of Oceans and Seas", features: "Global Standard" },
      { name: "ISO 3166-1", desc: "Country Codes", features: "Alpha-2 Standard" }
    ]
  },
  {
    title: "4. Global High-Precision Mode",
    items: [
      { name: "Coverage", desc: "54+ African Countries, Europe, Asia, Americas", features: "Global Accuracy" },
      { name: "Multi-Box Approximation", desc: "Complex shapes (Italy, UK, France) split into sub-regions", features: "Higher Accuracy" },
      { name: "Land-First Priority", desc: "Country codes checked before sea regions for accuracy", features: "Zero Conflict" }
    ]
  }
];

export const SYSTEMATIC_THEMES: Record<string, string[]> = {
  geomorphology: ['fluvial', 'coastal', 'volcanic', 'karst', 'glacial', 'tectonic'],
  climatology: ['precipitation', 'temperature', 'wind', 'zones'],
  hydrology: ['rivers', 'lakes', 'groundwater', 'springs'],
  biogeography: ['flora', 'fauna', 'protected_areas'],
  soil: ['types', 'moisture'],
  disaster: ['flood', 'landslide', 'seismic', 'volcanic_hazard'],
  marine: ['bathymetry', 'currents', 'reefs'],
  earth_system: ['plates', 'faults', 'volcanoes'],
  economic: ['retail', 'finance', 'resources', 'services'],
  urban: ['landuse', 'infrastructure', 'housing', 'central_business'],
  cultural: ['religion', 'language', 'heritage', 'food'],
  political: ['boundaries', 'administrative', 'military'],
  population: ['density', 'migration', 'demographics'],
  transport: ['road', 'rail', 'air', 'sea'],
  agricultural: ['crops', 'livestock', 'irrigation'],
  industrial: ['manufacturing', 'mining', 'energy'],
  tourism: ['attractions', 'hotels', 'facilities'],
  earth_science: ['geology', 'mineralogy', 'paleontology'],
  oceanography: ['waves', 'tides', 'salinity', 'temperature_profile']
};

export const REGIONAL_THEMES: Record<string, string[]> = {
  static: ['nature', 'history', 'tradition', 'landscape'],
  dynamic: ['urbanization', 'environment_change', 'globalization', 'migration_flow'],
};

export const MAJOR_CATEGORIES = [
  { id: 'Asia', name: 'アジア', en: 'Asia', icon: Globe },
  { id: 'Africa', name: 'アフリカ', en: 'Africa', icon: Globe },
  { id: 'Oceania', name: 'オセアニア', en: 'Oceania', icon: Globe },
  { id: 'Americas', name: 'アメリカ', en: 'Americas', icon: Globe },
  { id: 'Europe', name: 'ヨーロッパ', en: 'Europe', icon: Globe },
  { id: 'Territories', name: '海外領・自治領', en: 'Territories', icon: ShieldCheck },
  { id: 'Disputed', name: '係争地域', en: 'Disputed', icon: AlertOctagon }
];

export const MAP_STYLES = [
  { id: 'bright', name: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright', thumb: 'https://picsum.photos/seed/map-bright/100/100' },
  { id: 'liberty', name: 'Liberty', url: 'https://tiles.openfreemap.org/styles/liberty', thumb: 'https://picsum.photos/seed/map-liberty/100/100' },
  { id: 'positron', name: 'Light', url: 'https://tiles.openfreemap.org/styles/positron', thumb: 'https://picsum.photos/seed/map-light/100/100' },
  { id: 'dark', name: 'Dark', url: 'https://tiles.openfreemap.org/styles/dark', thumb: 'https://picsum.photos/seed/map-dark/100/100' },
  { id: 'satellite', name: 'Satellite', url: 'satellite', thumb: 'https://picsum.photos/seed/satellite-view/100/100' },
];
