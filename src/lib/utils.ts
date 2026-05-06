import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robust fetch with retries and timeout
 */
export async function fetchWithRetry(url: string, options: any = {}, retries = 2, defaultTimeout = 20000): Promise<Response> {
  const timeoutMs = options.timeout || defaultTimeout;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { 
      ...options, 
      signal: options.signal || controller.signal 
    });
    
    clearTimeout(id);

    if (!response.ok && response.status >= 500 && retries > 0) {
      console.warn(`[Fetch Utility] Retrying ${url} due to status ${response.status}`);
      throw new Error('Retry');
    }
    return response;
  } catch (err: any) {
    clearTimeout(id);
    
    if (retries > 0) {
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
      const waitTime = isTimeout ? 500 : 1500 * (3 - retries);
      await new Promise(r => setTimeout(r, waitTime));
      return fetchWithRetry(url, options, retries - 1, timeoutMs);
    }
    throw err;
  }
}
