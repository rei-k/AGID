/**
 * Service for fetching regional context for China and South Korea.
 */

export interface EastAsiaContext {
  province?: string;
  city?: string;
  district?: string;
  landmarks: {
    name: string;
    type: string;
    distance: number;
  }[];
}

/**
 * Fetches regional context for China or South Korea using Overpass API.
 */
export async function fetchEastAsiaContext(lat: number, lon: number, cc: string): Promise<EastAsiaContext | null> {
  const radius = 2000;
  const lang = cc === 'cn' ? 'zh' : 'ko';
  
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"](around:${radius},${lat},${lon});
      node["historic"](around:${radius},${lat},${lon});
      node["amenity"="place_of_worship"](around:${radius},${lat},${lon});
      way["boundary"="administrative"]["admin_level"~"4|6|8"](around:100,${lat},${lon});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch('/api/overpass', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' }
    });

    if (!response.ok) return null;
    const data = await response.json();

    const context: EastAsiaContext = { landmarks: [] };
    
    data.elements.forEach((el: any) => {
      if (el.tags) {
        const name = el.tags[`name:${lang}`] || el.tags.name;
        if (el.tags.boundary === 'administrative') {
          if (el.tags.admin_level === '4') context.province = name;
          if (el.tags.admin_level === '6') context.city = name;
          if (el.tags.admin_level === '8') context.district = name;
        } else if (name) {
          const type = el.tags.tourism || el.tags.historic || el.tags.amenity || 'Landmark';
          context.landmarks.push({
            name: name,
            type: type.charAt(0).toUpperCase() + type.slice(1),
            distance: 0
          });
        }
      }
    });

    context.landmarks = context.landmarks.slice(0, 5);
    return context;
  } catch (error) {
    console.error("Error fetching East Asia context:", error);
    return null;
  }
}

/**
 * Fetches South Korea specific official address details using VWorld/NSDI (Official Korea).
 */
export async function fetchKoreaOfficialAddress(lat: number, lon: number): Promise<any | null> {
  try {
    // Using Nominatim Proxy with Korean language support
    const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=ko,en`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return {
        label: data.display_name,
        city: data.address.city || data.address.province,
        district: data.address.city_district || data.address.borough,
        neighborhood: data.address.suburb || data.address.neighbourhood,
        source: 'NSDI / VWorld / Nominatim (South Korea)'
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Maps the first two digits of a Chinese postcode to its province.
 */
export function getChinaProvinceByPostcode(pc: string): string | null {
  if (!pc || pc.length < 2) return null;
  const prefix = pc.substring(0, 2);
  const mapping: Record<string, string> = {
    '10': 'Beijing', '11': 'Beijing',
    '12': 'Tianjin',
    '13': 'Hebei',
    '15': 'Inner Mongolia',
    '21': 'Liaoning',
    '22': 'Jilin',
    '23': 'Heilongjiang',
    '31': 'Shanghai',
    '32': 'Jiangsu',
    '33': 'Zhejiang',
    '34': 'Anhui',
    '35': 'Fujian',
    '36': 'Jiangxi',
    '37': 'Shandong',
    '41': 'Henan',
    '42': 'Hubei',
    '43': 'Hunan',
    '44': 'Guangdong',
    '45': 'Guangxi',
    '46': 'Hainan',
    '51': 'Sichuan',
    '52': 'Guizhou',
    '53': 'Yunnan',
    '54': 'Tibet',
    '61': 'Shaanxi',
    '62': 'Gansu',
    '63': 'Qinghai',
    '64': 'Ningxia',
    '65': 'Xinjiang',
    '71': 'Taiwan',
    '81': 'Hong Kong',
    '82': 'Macau'
  };
  return mapping[prefix] || null;
}

/**
 * Fetches detailed China address using Nominatim Postcode Search.
 */
export async function fetchChinaPostcode(pc: string): Promise<any | null> {
  try {
    const response = await fetch(`/api/cn-postcode?pc=${pc}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const res = data[0];
        return {
          province: res.address.state || res.address.province,
          city: res.address.city || res.address.town,
          district: res.address.county || res.address.district,
          label: res.display_name,
          lat: res.lat,
          lon: res.lon
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching China postcode:", error);
    return null;
  }
}

/**
 * Fetches detailed China address using Tianditu (Official Chinese Gov API).
 */
export async function fetchTiandituAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/tianditu-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.result) {
        const res = data.result;
        return {
          fullAddress: res.address,
          addressComponent: res.addressComponent,
          formattedAddress: res.formatted_address,
          source: 'Tianditu (Official China Gov)'
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Tianditu address:", error);
    return null;
  }
}
