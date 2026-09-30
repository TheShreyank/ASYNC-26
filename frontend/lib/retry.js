/**
 * Retries an async function with exponential backoff on 429 / 503.
 * @param {() => Promise<any>} fn - async factory that returns a response/value
 * @param {number} [attempts=3]
 * @returns {Promise<any>}
 */
export async function withRetry(fn, attempts = 3) {
  let delay = 1000;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      if ((status === 429 || status === 503) && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

/**
 * Wraps a fetch call and throws a structured error on non-OK responses.
 * Retries on 429 / 503 with exponential backoff.
 * Always returns the Response object on success.
 */
export async function fetchWithRetry(url, options, attempts = 3) {
  let delay = 1000;
  let lastErr;

  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, options);

    if (res.ok) return res; // ✅ always returns on success

    const retryable = res.status === 429 || res.status === 503;
    const text = await res.text();

    if (retryable && i < attempts - 1) {
      console.warn(`fetchWithRetry: HTTP ${res.status}, retrying in ${delay}ms... (attempt ${i + 1}/${attempts})`);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
      continue;
    }

    const err = new Error(text || `HTTP ${res.status}`);
    err.status = res.status;
    lastErr = err;
    break;
  }

  throw lastErr;
}

