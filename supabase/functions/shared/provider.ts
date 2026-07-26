export class ProviderTimeoutError extends Error {
  constructor() {
    super("Provider request timed out");
    this.name = "ProviderTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
