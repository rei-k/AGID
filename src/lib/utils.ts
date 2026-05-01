import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robust fetch with retries and timeout
 */
export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 2, timeout = 20000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    if (retries > 0) {
      // Exponential backoff
      await new Promise(r => setTimeout(r, 1000 * (3 - retries)));
      return fetchWithRetry(url, options, retries - 1, timeout);
    }
    throw err;
  }
}
