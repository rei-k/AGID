/**
 * Service for fetching regional context for South America (Brazil, etc.).
 */

export interface SouthAmericaContext {
  state?: string;
  municipality?: string;
  landmarks: {
    name: string;
    type: string;
    distance: number;
  }[];
}

/**
 * Fetches regional context for South America using Overpass API.
 */
export async function fetchSouthAmericaContext(lat: number, lon: number, cc: string): Promise<SouthAmericaContext | null> {
  const radius = 2000;
  
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"](around:${radius},${lat},${lon});
      node["historic"](around:${radius},${lat},${lon});
      node["leisure"="park"](around:${radius},${lat},${lon});
      way["boundary"="administrative"]["admin_level"~"4|8"](around:100,${lat},${lon});
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

    const context: SouthAmericaContext = { landmarks: [] };
    
    data.elements.forEach((el: any) => {
      if (el.tags) {
        if (el.tags.boundary === 'administrative') {
          if (el.tags.admin_level === '4') context.state = el.tags.name;
          if (el.tags.admin_level === '8') context.municipality = el.tags.name;
        } else if (el.tags.name) {
          const type = el.tags.tourism || el.tags.historic || el.tags.leisure || 'Landmark';
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
  } catch (error) {
    console.error("Error fetching South America context:", error);
    return null;
  }
}

/**
 * Fetches detailed Brazil address using IBGE (Official Brazil).
 */
export async function fetchBrazilOfficialAddress(lat: number, lon: number): Promise<any | null> {
  try {
    const response = await fetch(`/api/br-ibge-address?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const res = data[0];
        return {
          label: res.nome,
          municipality: res.municipio?.nome,
          state: res.municipio?.microrregiao?.mesorregiao?.UF?.nome,
          source: 'IBGE (Official Brazil)'
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetches detailed Brazil address using ViaCEP API via server proxy.
 */
export async function fetchBrazilViaCEP(cep: string): Promise<any | null> {
  if (!cep) return null;
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  try {
    const response = await fetch(`/api/br-viacep/${cleanCep}`);
    if (response.ok) {
      const data = await response.json();
      if (data && !data.erro) {
        return {
          label: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`,
          road: data.logradouro,
          suburb: data.bairro,
          city: data.localidade,
          state: data.uf,
          postcode: data.cep,
          source: 'ViaCEP (Brazil)'
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching ViaCEP data:", error);
    return null;
  }
}

/**
 * Fetches South America specific official address details if available.
 */
export async function fetchSouthAmericaOfficialAddress(lat: number, lon: number, cc: string): Promise<any | null> {
  try {
    // Specialized queries for South American countries
    if (cc === 'ar') {
      // Argentina IGN pattern (simulated via specialized Nominatim for now)
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=es`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          province: data.address.province || data.address.state,
          department: data.address.county,
          source: 'IGN / Nominatim (Argentina)'
        };
      }
    }
    
    if (cc === 'cl') {
      // Chile IDE pattern
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=es`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          province: data.address.county,
          commune: data.address.city || data.address.town,
          source: 'IDE / Nominatim (Chile)'
        };
      }
    }

    if (cc === 'co') {
      // Colombia IGAC pattern
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=es`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          department: data.address.state,
          municipality: data.address.city || data.address.town,
          source: 'IGAC / Nominatim (Colombia)'
        };
      }
    }

    if (cc === 'pe') {
      // Peru IGN pattern
      const url = `/api/osm-reverse?lat=${lat}&lon=${lon}&lang=es`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          label: data.display_name,
          region: data.address.state,
          province: data.address.county,
          district: data.address.city || data.address.town,
          source: 'IGN / Nominatim (Peru)'
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
