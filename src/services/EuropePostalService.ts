
/**
 * Fetches detailed French address and postcode info from BAN API via server proxy.
 */
export async function fetchFrenchAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/fr-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const props = data.features[0].properties;
        return {
          postcode: props.postcode,
          city: props.city,
          street: props.name,
          houseNumber: props.housenumber,
          context: props.context, // Department info
          label: props.label
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching French address:", error);
    return null;
  }
}

/**
 * Fetches detailed Dutch address and postcode info from PDOK API via server proxy.
 */
export async function fetchDutchAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/nl-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data.response && data.response.docs && data.response.docs.length > 0) {
        const doc = data.response.docs[0];
        return {
          postcode: doc.postcode,
          city: doc.woonplaatsnaam,
          street: doc.straatnaam,
          houseNumber: doc.huisnummer,
          label: doc.weergavenaam
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Dutch address:", error);
    return null;
  }
}

/**
 * Fetches detailed German address from BKG proxy.
 */
export async function fetchGermanAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/de-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.village,
        street: data.address.road,
        houseNumber: data.address.house_number,
        state: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching German address:", error);
    return null;
  }
}

/**
 * Fetches detailed Belgian address from regional proxy.
 */
export async function fetchBelgianAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/be-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        region: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Belgian address:", error);
    return null;
  }
}

/**
 * Fetches detailed Swiss address from swisstopo proxy.
 */
export async function fetchSwissAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/ch-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const attrs = data.results[0].attributes;
        return {
          postcode: attrs.plz,
          city: attrs.ort,
          street: attrs.strname,
          houseNumber: attrs.deinr,
          label: `${attrs.strname} ${attrs.deinr}, ${attrs.plz} ${attrs.ort}`
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Swiss address:", error);
    return null;
  }
}

/**
 * Fetches detailed Austrian address from BEV proxy.
 */
export async function fetchAustrianAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/at-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        state: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Austrian address:", error);
    return null;
  }
}

/**
 * Fetches detailed Swedish address from Lantmäteriet proxy.
 */
export async function fetchSwedishAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/se-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        county: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Swedish address:", error);
    return null;
  }
}

/**
 * Fetches detailed Estonian address from Maa-amet proxy.
 */
export async function fetchEstonianAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/ee-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.village,
        street: data.address.road,
        houseNumber: data.address.house_number,
        county: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Estonian address:", error);
    return null;
  }
}

/**
 * Fetches detailed Latvian address from LĢIA proxy.
 */
export async function fetchLatvianAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/lv-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        region: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Latvian address:", error);
    return null;
  }
}

/**
 * Fetches detailed Lithuanian address from Registrų centras proxy.
 */
export async function fetchLithuanianAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/lt-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        county: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Lithuanian address:", error);
    return null;
  }
}

/**
 * Fetches detailed Icelandic address from Landmælingar Íslands proxy.
 */
export async function fetchIcelandicAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/is-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        region: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Icelandic address:", error);
    return null;
  }
}

/**
 * Fetches detailed Italian address.
 */
export async function fetchItalianAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/it-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        province: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Italian address:", error);
    return null;
  }
}

/**
 * Fetches detailed Spanish address.
 */
export async function fetchSpanishAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/es-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        province: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Spanish address:", error);
    return null;
  }
}

/**
 * Fetches detailed Portuguese address.
 */
export async function fetchPortugueseAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/pt-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        district: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Portuguese address:", error);
    return null;
  }
}

/**
 * Fetches detailed Greek address.
 */
export async function fetchGreekAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/gr-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        region: data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Greek address:", error);
    return null;
  }
}

/**
 * Fetches detailed Maltese address.
 */
export async function fetchMalteseAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/mt-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Maltese address:", error);
    return null;
  }
}

/**
 * Fetches detailed Cypriot address.
 */
export async function fetchCypriotAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/cy-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town,
        street: data.address.road,
        houseNumber: data.address.house_number,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Cypriot address:", error);
    return null;
  }
}

/**
 * Fetches detailed address for Microstates.
 */
export async function fetchMicrostateAddress(lat: number, lon: number, cc: string): Promise<any | null> {
  try {
    const response = await fetch(`/api/microstate-address?lat=${lat}&lon=${lon}&cc=${cc}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.village,
        street: data.address.road,
        houseNumber: data.address.house_number,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching Microstate address (${cc}):`, error);
    return null;
  }
}

/**
 * Fetches detailed address for Eastern European and Balkan countries.
 */
export async function fetchEEBalkanAddress(lat: number, lon: number, cc: string): Promise<any | null> {
  try {
    const response = await fetch(`/api/ee-balkan-address?lat=${lat}&lon=${lon}&cc=${cc}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.village,
        street: data.address.road,
        houseNumber: data.address.house_number,
        state: data.address.state || data.address.province,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching EE/Balkan address (${cc}):`, error);
    return null;
  }
}

/**
 * Fetches detailed Belgium address using BeST Address (Aggregated Regional Data).
 */
export async function fetchBelgiumBestAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/be-best-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        return {
          street: data.address.Address,
          city: data.address.City,
          postcode: data.address.Postal,
          label: `${data.address.Address}, ${data.address.Postal} ${data.address.City}`,
          source: 'BeST Address (Belgium Official)'
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Belgium BeST address:", error);
    return null;
  }
}

/**
 * Fetches detailed Czech address using RÚIAN (Official State API).
 */
export async function fetchCzechRuianAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/cz-ruian-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      // Handle Mapy.cz fallback format or RÚIAN format
      if (data.address) {
        return {
          street: data.address.street,
          city: data.address.city,
          postcode: data.address.zip,
          label: data.address.label || `${data.address.street}, ${data.address.city}`,
          source: 'RÚIAN / Mapy.cz (Czech Official)'
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Czech RÚIAN address:", error);
    return null;
  }
}

/**
 * Fetches detailed Spain address using Catastro (Official Cadastre).
 */
export async function fetchSpainCatastroAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/es-catastro-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const xmlText = await response.text();
      // Simple XML parsing for Catastro
      const getTag = (tag: string) => {
        const match = xmlText.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
        return match ? match[1] : '';
      };
      const ldir = getTag('ldir'); // Full address string
      const cp = getTag('cp'); // Postcode
      const nm = getTag('nm'); // Municipality
      
      if (ldir) {
        return {
          label: ldir,
          postcode: cp,
          city: nm,
          source: 'Sede Electrónica del Catastro (Spain Official)'
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Spain Catastro address:", error);
    return null;
  }
}

/**
 * Fetches detailed Irish address from GeoHive proxy.
 */
export async function fetchIrelandAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/ie-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.city_district,
        street: data.address.road,
        houseNumber: data.address.house_number,
        county: data.address.county,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Irish address:", error);
    return null;
  }
}

/**
 * Fetches detailed UK address from OSM/Postcode proxy.
 */
export async function fetchUKAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/uk-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.village || data.address.suburb,
        street: data.address.road,
        houseNumber: data.address.house_number,
        county: data.address.county || data.address.state,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching UK address:", error);
    return null;
  }
}

/**
 * Fetches detailed Luxembourg address from Geoportail proxy.
 */
export async function fetchLuxembourgAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/lu-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return {
        postcode: data.address.postcode,
        city: data.address.city || data.address.town || data.address.village,
        street: data.address.road,
        houseNumber: data.address.house_number,
        quarter: data.address.suburb,
        label: data.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Luxembourg address:", error);
    return null;
  }
}

/**
 * Fetches detailed Polish address from GUGiK proxy (Official Poland).
 */
export async function fetchPolishAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/pl-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.result) {
        return {
          label: data.result,
          source: 'GUGiK (Poland Official)'
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching Polish address:", error);
    return null;
  }
}
