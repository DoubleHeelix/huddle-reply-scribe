export const MAX_GENERATION_ATTEMPTS = 2;
export const BASE_RETRY_DELAY_MS = 750;
const MAX_RETRY_DELAY_MS = 3_000;

export class RetryableGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableGenerationError";
  }
}

export const extractGenerationHttpStatus = (
  error: unknown
): number | null => {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\b([1-5]\d{2})\b/);
  return match ? Number(match[1]) : null;
};

export const isRetryableGenerationError = (error: unknown): boolean => {
  if (error instanceof RetryableGenerationError) return true;

  const status = extractGenerationHttpStatus(error);
  if (status !== null) {
    return [408, 500, 502, 503, 504].includes(status);
  }

  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|timed out|abort|load failed|connection/i.test(
    message
  );
};

export const getGenerationRetryDelayMs = (attempt: number): number => {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(
    BASE_RETRY_DELAY_MS * 2 ** exponent,
    MAX_RETRY_DELAY_MS
  );
};

interface RetryContext {
  attempt: number;
  nextAttempt: number;
  maxAttempts: number;
  delayMs: number;
  error: unknown;
}

interface GenerationRetryOptions {
  onRetry?: (context: RetryContext) => void;
  sleep?: (delayMs: number) => Promise<void>;
}

const defaultSleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export const runWithGenerationRetry = async <T>(
  operation: (attempt: number, maxAttempts: number) => Promise<T>,
  options: GenerationRetryOptions = {}
): Promise<T> => {
  const sleep = options.sleep ?? defaultSleep;

  for (
    let attempt = 1;
    attempt <= MAX_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await operation(attempt, MAX_GENERATION_ATTEMPTS);
    } catch (error) {
      const canRetry =
        attempt < MAX_GENERATION_ATTEMPTS &&
        isRetryableGenerationError(error);

      if (!canRetry) throw error;

      const delayMs = getGenerationRetryDelayMs(attempt);
      options.onRetry?.({
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts: MAX_GENERATION_ATTEMPTS,
        delayMs,
        error,
      });
      await sleep(delayMs);
    }
  }

  throw new Error("Generation retry policy exhausted unexpectedly");
};
