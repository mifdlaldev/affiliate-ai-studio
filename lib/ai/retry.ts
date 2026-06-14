export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
}

/**
 * Shape of an HTTP error carrying status + headers (e.g. from OpenAI SDK).
 * We use a local structural type to avoid an `any` cast.
 */
interface HttpErrorLike {
  status?: number;
  headers?: Record<string, string>;
}

function asHttpError(error: unknown): Error & HttpErrorLike {
  if (error instanceof Error) {
    return error as Error & HttpErrorLike;
  }
  return new Error(String(error)) as Error & HttpErrorLike;
}

/**
 * Retry an async function with exponential backoff.
 *
 * - Retries up to `maxRetries` times (default: 3).
 * - For HTTP 429 (rate limit), honors the `Retry-After` header (in seconds).
 * - For other errors, uses exponential backoff: `baseDelay * 2^i` ms.
 * - Re-throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  let lastError: Error & HttpErrorLike = new Error("withRetry: no result");

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = asHttpError(error);
      const isLast = i === maxRetries - 1;
      const isRateLimit = lastError.status === 429;

      if (isLast) throw lastError;

      let delay: number;
      if (isRateLimit) {
        const retryAfterHeader = lastError.headers?.["retry-after"];
        const retryAfterSeconds = retryAfterHeader
          ? parseInt(retryAfterHeader, 10)
          : NaN;
        delay = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 5000;
      } else {
        // Exponential backoff: baseDelay, 2*baseDelay, 4*baseDelay
        delay = baseDelay * Math.pow(2, i);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable when maxRetries >= 1 (loop either returns or throws), but the
  // compiler wants an explicit terminator.
  throw lastError;
}
