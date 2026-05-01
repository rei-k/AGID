/**
 * Shared fetch utility with retry logic for API calls.
 */
export async function fetchWithRetry(url: string, options: any = {}, retries = 2): Promise<Response> {
  const timeoutMs = options.timeout || 90000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok && response.status >= 500 && retries > 0) {
      console.warn(`[Fetch Utility] Retrying ${url} due to status ${response.status}`);
      throw new Error('Retry');
    }
    return response;
  } catch (e: any) {
    clearTimeout(timeoutId);
    
    if (retries > 0) {
      const isTimeout = e.name === 'AbortError' || e.message?.includes('timeout');
      const waitTime = isTimeout ? 500 : 1500 * (3 - retries);
      await new Promise(r => setTimeout(r, waitTime));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw e;
  }
}
