/**
 * Service for fetching regional context for Africa.
 */

import { fetchWithRetry } from '../lib/utils';

export interface AfricaContext {
  region?: string;
  province?: string;
  district?: string;
  landmarks: {
    name: string;
    type: string;
    distance: number;
  }[];
}

/**
 * Fetches regional context for Africa using Overpass API.
 */
export async function fetchAfricaContext(lat: number, lon: number, cc: string): Promise<AfricaContext | null> {
  const radius = 3000;
  
  // Query for administrative boundaries (Region, Province, District) and landmarks
  const query = `
    [out:json][timeout:60];
    (
      node["tourism"](around:${radius},${lat},${lon});
      node["historic"](around:${radius},${lat},${lon});
      node["amenity"~"place_of_worship|market|school"](around:${radius},${lat},${lon});
      way["boundary"="administrative"]["admin_level"~"3|4|6|8"](around:200,${lat},${lon});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetchWithRetry('/api/overpass', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' }
    });

    if (!response.ok) {
      console.warn(`Africa context request failed with status: ${response.status}`);
      return null;
    }
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Africa context parsing error (received non-JSON):", text.substring(0, 100));
      return null;
    }

    if (!data || !data.elements) {
      console.warn("Africa context returned no elements:", data);
      return null;
    }

    const context: AfricaContext = { landmarks: [] };
    
    data.elements.forEach((el: any) => {
      if (el.tags) {
        if (el.tags.boundary === 'administrative') {
          // Admin level mapping in Africa: 4 is usually Province/Region, 6 is District
          if (el.tags.admin_level === '3' || el.tags.admin_level === '4') {
            context.province = el.tags.name;
          }
          if (el.tags.admin_level === '6') {
            context.district = el.tags.name;
          }
        } else if (el.tags.name) {
          const type = el.tags.tourism || el.tags.historic || el.tags.amenity || 'Landmark';
          context.landmarks.push({
            name: el.tags.name,
            type: type.charAt(0).toUpperCase() + type.slice(1),
            distance: 0
          });
        }
      }
    });

    context.landmarks = context.landmarks.slice(0, 5);
    return context;
  } catch (error: any) {
    if (error.name === 'AbortError') return null;
    console.error("Error fetching Africa context:", error);
    return null;
  }
}

/**
 * Fetches Africa specific official address details if available.
 */
export async function fetchAfricaOfficialAddress(lat: number, lon: number, cc: string): Promise<any | null> {
  try {
    // Specialized queries for African countries
    if (cc === 'za') {
      // South Africa (Stats SA / Municipalities)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state || data.address.province,
          municipality: data.address.city || data.address.town || data.address.municipality,
          source: 'Stats SA / Nominatim (South Africa)'
        };
      }
    }
    
    if (cc === 'ng') {
      // Nigeria (NIPOST / States)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          state: data.address.state,
          lga: data.address.county || data.address.city_district || data.address.district,
          postcode: data.address.postcode,
          source: 'NIPOST / Nominatim (Nigeria)'
        };
      }
    }

    if (cc === 'ke') {
      // Kenya (KNBS / Counties)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=en,sw`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          county: data.address.state || data.address.county,
          sub_county: data.address.city_district || data.address.suburb || data.address.district,
          postcode: data.address.postcode,
          source: 'KNBS / Nominatim (Kenya)'
        };
      }
    }

    if (cc === 'eg') {
      // Egypt (CAPMAS / Egypt Post)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=ar,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          governorate: data.address.state,
          city: data.address.city || data.address.town,
          postcode: data.address.postcode,
          source: 'CAPMAS / Egypt Post / Nominatim'
        };
      }
    }

    if (cc === 'ma') {
      // Morocco (HCP / Poste Maroc)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=ar,fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          province: data.address.county || data.address.province,
          postcode: data.address.postcode,
          source: 'HCP / Poste Maroc / Nominatim'
        };
      }
    }

    if (cc === 'dz') {
      // Algeria (Algérie Poste)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=ar,fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          wilaya: data.address.state,
          daira: data.address.county,
          commune: data.address.city || data.address.town,
          postcode: data.address.postcode,
          source: 'Algérie Poste / Nominatim'
        };
      }
    }

    if (cc === 'tn') {
      // Tunisia (La Poste Tunisienne)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=ar,fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          governorate: data.address.state,
          delegation: data.address.county || data.address.district,
          postcode: data.address.postcode,
          source: 'La Poste Tunisienne / Nominatim'
        };
      }
    }

    if (cc === 'ly') {
      // Libya (Libya Post)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=ar,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          district: data.address.state || data.address.county,
          city: data.address.city || data.address.town,
          postcode: data.address.postcode,
          source: 'Libya Post / Nominatim'
        };
      }
    }

    if (cc === 'et') {
      // Ethiopia (CSA / States)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=am,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          zone: data.address.county,
          woreda: data.address.city_district || data.address.suburb,
          source: 'CSA / Nominatim (Ethiopia)'
        };
      }
    }

    if (cc === 'tz') {
      // Tanzania (NBS / Regions)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=sw,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          district: data.address.county || data.address.city,
          ward: data.address.suburb || data.address.village,
          postcode: data.address.postcode,
          source: 'NBS / Nominatim (Tanzania)'
        };
      }
    }

    if (cc === 'ug') {
      // Uganda (UBOS / Districts)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          district: data.address.county,
          sub_county: data.address.city_district || data.address.suburb,
          postcode: data.address.postcode,
          source: 'UBOS / Nominatim (Uganda)'
        };
      }
    }

    if (cc === 'rw') {
      // Rwanda (NISR / Provinces)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=rw,en,fr`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          district: data.address.county,
          sector: data.address.city_district || data.address.suburb,
          postcode: data.address.postcode,
          source: 'NISR / Nominatim (Rwanda)'
        };
      }
    }

    if (cc === 'bi') {
      // Burundi (ISTEEBU / Provinces)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=rn,fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          commune: data.address.county || data.address.city,
          source: 'ISTEEBU / Nominatim (Burundi)'
        };
      }
    }

    if (cc === 'cd') {
      // Democratic Republic of the Congo (INS / Provinces)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state || data.address.province,
          city: data.address.city || data.address.town,
          commune: data.address.suburb || data.address.neighbourhood,
          source: 'INS / Nominatim (DR Congo)'
        };
      }
    }

    if (cc === 'cm') {
      // Cameroon (INS / Regions)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          department: data.address.county,
          arrondissement: data.address.city_district || data.address.suburb,
          source: 'INS / Nominatim (Cameroon)'
        };
      }
    }

    if (cc === 'ga') {
      // Gabon (Direction Générale de la Statistique)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          department: data.address.county,
          commune: data.address.city || data.address.town,
          source: 'DGS / Nominatim (Gabon)'
        };
      }
    }

    if (cc === 'cg') {
      // Republic of the Congo (INS / Departments)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          department: data.address.state,
          district: data.address.county,
          commune: data.address.city || data.address.town,
          source: 'INS / Nominatim (Congo)'
        };
      }
    }

    if (cc === 'td') {
      // Chad (INSEED / Provinces)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,ar,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          department: data.address.county,
          source: 'INSEED / Nominatim (Chad)'
        };
      }
    }

    if (cc === 'gh') {
      // Ghana (Ghana Statistical Service / Regions)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state || data.address.province,
          district: data.address.county || data.address.city_district,
          postcode: data.address.postcode,
          source: 'GSS / Nominatim (Ghana)'
        };
      }
    }

    if (cc === 'ci') {
      // Ivory Coast (INS / Regions)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          district: data.address.state,
          region: data.address.province,
          department: data.address.county,
          postcode: data.address.postcode,
          source: 'INS / Nominatim (Ivory Coast)'
        };
      }
    }

    if (cc === 'sn') {
      // Senegal (ANSD / Regions)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          department: data.address.county,
          arrondissement: data.address.city_district,
          postcode: data.address.postcode,
          source: 'ANSD / Nominatim (Senegal)'
        };
      }
    }

    if (cc === 'bf') {
      // Burkina Faso (INSD / Regions)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          province: data.address.province,
          department: data.address.county,
          postcode: data.address.postcode,
          source: 'INSD / Nominatim (Burkina Faso)'
        };
      }
    }

    if (cc === 'ml') {
      // Mali (INSTAT / Regions)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          cercle: data.address.county,
          commune: data.address.city || data.address.town,
          postcode: data.address.postcode,
          source: 'INSTAT / Nominatim (Mali)'
        };
      }
    }

    if (cc === 'sd') {
      // Sudan (CBS / States)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ar,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          state: data.address.state,
          locality: data.address.county || data.address.city,
          source: 'CBS / Nominatim (Sudan)'
        };
      }
    }

    if (cc === 'mr') {
      // Mauritania (ONS / Regions)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ar,fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          moughataa: data.address.county,
          commune: data.address.city || data.address.town,
          source: 'ONS / Nominatim (Mauritania)'
        };
      }
    }

    if (cc === 'eh') {
      // Western Sahara
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ar,es,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          province: data.address.county,
          city: data.address.city || data.address.town,
          source: 'Nominatim (Western Sahara)'
        };
      }
    }

    if (cc === 'km') {
      // Comoros (La Poste des Comores)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=fr,ar,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          island: data.address.state,
          prefecture: data.address.county,
          postcode: data.address.postcode,
          source: 'La Poste des Comores / Nominatim'
        };
      }
    }

    if (cc === 'dj') {
      // Djibouti (La Poste de Djibouti)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=fr,ar,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          district: data.address.county,
          postcode: data.address.postcode,
          source: 'La Poste de Djibouti / Nominatim'
        };
      }
    }

    if (cc === 'er') {
      // Eritrea (Eritrean Postal Service)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=ti,ar,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          sub_region: data.address.county,
          source: 'Eritrean Postal Service / Nominatim'
        };
      }
    }

    if (cc === 'mg') {
      // Madagascar (Paositra Malagasy)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=mg,fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          region: data.address.county,
          district: data.address.city,
          postcode: data.address.postcode,
          source: 'Paositra Malagasy / Nominatim'
        };
      }
    }

    if (cc === 'mw') {
      // Malawi (Malawi Posts Corporation)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          district: data.address.county,
          postcode: data.address.postcode,
          source: 'Malawi Posts / Nominatim'
        };
      }
    }

    if (cc === 'mu') {
      // Mauritius (Mauritius Post)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=en,fr`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          district: data.address.state || data.address.county,
          city: data.address.city || data.address.town,
          postcode: data.address.postcode,
          source: 'Mauritius Post / Nominatim'
        };
      }
    }

    if (cc === 'mz') {
      // Mozambique (Correios de Moçambique)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=pt,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          district: data.address.county,
          postcode: data.address.postcode,
          source: 'Correios de Moçambique / Nominatim'
        };
      }
    }

    if (cc === 'sc') {
      // Seychelles (Seychelles Postal Services)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=en,fr`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          island: data.address.state,
          district: data.address.county,
          postcode: data.address.postcode,
          source: 'Seychelles Post / Nominatim'
        };
      }
    }

    if (cc === 'so') {
      // Somalia (Somali Postal Service)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=so,ar,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          district: data.address.county,
          source: 'Somali Post / Nominatim'
        };
      }
    }

    if (cc === 'ss') {
      // South Sudan
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          state: data.address.state,
          county: data.address.county,
          source: 'Nominatim (South Sudan)'
        };
      }
    }

    if (cc === 'zm') {
      // Zambia (Zampost)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          district: data.address.county,
          postcode: data.address.postcode,
          source: 'Zampost / Nominatim'
        };
      }
    }

    if (cc === 'na') {
      // Namibia (NamPost)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          constituency: data.address.county,
          postcode: data.address.postcode,
          source: 'NamPost / Nominatim'
        };
      }
    }

    if (cc === 'bw') {
      // Botswana (BotswanaPost)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          district: data.address.state || data.address.county,
          village: data.address.city || data.address.town,
          postcode: data.address.postcode,
          source: 'BotswanaPost / Nominatim'
        };
      }
    }

    if (cc === 'zw') {
      // Zimbabwe (Zimpost)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          district: data.address.county,
          postcode: data.address.postcode,
          source: 'Zimpost / Nominatim'
        };
      }
    }

    if (cc === 'ls') {
      // Lesotho (Lesotho Post)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          district: data.address.state || data.address.county,
          postcode: data.address.postcode,
          source: 'Lesotho Post / Nominatim'
        };
      }
    }

    if (cc === 'sz') {
      // Eswatini (Eswatini Post)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          district: data.address.county,
          postcode: data.address.postcode,
          source: 'Eswatini Post / Nominatim'
        };
      }
    }

    if (cc === 'ao') {
      // Angola (Correios de Angola)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=pt,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          municipality: data.address.county,
          postcode: data.address.postcode,
          source: 'Correios de Angola / Nominatim'
        };
      }
    }

    if (cc === 'ne') {
      // Niger (Niger Poste)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          department: data.address.county,
          commune: data.address.city || data.address.town,
          postcode: data.address.postcode,
          source: 'Niger Poste / Nominatim'
        };
      }
    }

    if (cc === 'tg') {
      // Togo (La Poste du Togo)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          prefecture: data.address.county,
          postcode: data.address.postcode,
          source: 'La Poste du Togo / Nominatim'
        };
      }
    }

    if (cc === 'bj') {
      // Benin (La Poste du Bénin)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          department: data.address.state,
          commune: data.address.county || data.address.city,
          arrondissement: data.address.city_district,
          postcode: data.address.postcode,
          source: 'La Poste du Bénin / Nominatim'
        };
      }
    }

    if (cc === 'lr') {
      // Liberia (Ministry of Posts and Telecommunications)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          county: data.address.state || data.address.county,
          district: data.address.city_district,
          source: 'MinPost / Nominatim (Liberia)'
        };
      }
    }

    if (cc === 'sl') {
      // Sierra Leone (SALPOST)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          district: data.address.county,
          source: 'SALPOST / Nominatim (Sierra Leone)'
        };
      }
    }

    if (cc === 'gm') {
      // Gambia (Gampost)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          division: data.address.state,
          district: data.address.county,
          source: 'Gampost / Nominatim (Gambia)'
        };
      }
    }

    if (cc === 'gn') {
      // Guinea (La Poste de Guinée)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          prefecture: data.address.county,
          source: 'La Poste de Guinée / Nominatim'
        };
      }
    }

    if (cc === 'gw') {
      // Guinea-Bissau (Correios da Guiné-Bissau)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=pt,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.state,
          region: data.address.county,
          sector: data.address.city_district,
          source: 'Correios da Guiné-Bissau / Nominatim'
        };
      }
    }

    if (cc === 'cv') {
      // Cape Verde (Correios de Cabo Verde)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=pt,en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          island: data.address.state,
          municipality: data.address.county,
          postcode: data.address.postcode,
          source: 'Correios de Cabo Verde / Nominatim'
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
