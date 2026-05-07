
import { fetchWithRetry } from '../lib/utils';

export interface GlobalWeather {
  temp: number;
  condition: string;
  humidity?: number;
  windSpeed?: number;
}

export interface LocalTimeInfo {
  time: string;
  date: string;
  timezone: string;
  offset: string;
}

/**
 * Service for fetching global real-time context like weather and local time.
 */
export async function fetchGlobalContext(lat: number, lon: number): Promise<{ weather: GlobalWeather | null, time: LocalTimeInfo | null }> {
  let weather: GlobalWeather | null = null;
  let time: LocalTimeInfo | null = null;

  try {
    // 1. Fetch Weather from Proxy
    const weatherRes = await fetchWithRetry(`/api/weather?latitude=${lat}&longitude=${lon}`, {}, 2, 15000);
    if (weatherRes.ok) {
      const contentType = weatherRes.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await weatherRes.json();
        if (data.current) {
          weather = {
            temp: data.current.temperature_2m,
            humidity: data.current.relative_humidity_2m,
            windSpeed: data.current.wind_speed_10m,
            condition: getWeatherCondition(data.current.weather_code)
          };
          
          // Use the timezone from Open-Meteo to calculate local time
          if (data.timezone) {
            const now = new Date();
            const options: Intl.DateTimeFormatOptions = {
              timeZone: data.timezone,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            };
            const dateOptions: Intl.DateTimeFormatOptions = {
              timeZone: data.timezone,
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            };
            
            time = {
              time: new Intl.DateTimeFormat('en-US', options).format(now),
              date: new Intl.DateTimeFormat('en-US', dateOptions).format(now),
              timezone: data.timezone,
              offset: data.utc_offset_seconds ? `${data.utc_offset_seconds / 3600}h` : ''
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("Error fetching global context:", err);
  }

  return { weather, time };
}

/**
 * Maps WMO Weather interpretation codes to human-readable strings.
 */
function getWeatherCondition(code: number): string {
  if (code === 0) return "Clear sky";
  if (code >= 1 && code <= 3) return "Partly cloudy";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 61 && code <= 65) return "Rainy";
  if (code >= 71 && code <= 77) return "Snowy";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}

/**
 * Fetches enriched postcode details globally using Zippopotam.us via proxy.
 */
export async function fetchGlobalPostcodeDetails(country: string, postcode: string): Promise<any | null> {
  if (!country || !postcode) return null;
  
  try {
    const response = await fetch(`/api/zippopotam/${country}/${encodeURIComponent(postcode.replace(/\s/g, ''))}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error fetching global postcode details:", error);
    return null;
  }
}

/**
 * Fetches Plus Code (Open Location Code) for coordinates.
 * Vital for addressing in areas without postal codes.
 */
export async function fetchPlusCode(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await fetch(`/api/plusmode/encode?lat=${lat}&lon=${lon}`);
    if (response.ok) {
      const data = await response.json();
      return data.plusCode || null;
    }
    return null;
  } catch (error) {
    console.error("Error encoding Plus Code:", error);
    return null;
  }
}
