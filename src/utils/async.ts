/**
 * Async utilities for timeout and retry logic
 */
import { logger } from "./logger.js";
import { MAX_RETRY_ATTEMPTS, GIT_TIMEOUT_MS } from "./constants.js";

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  op: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${op} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number = MAX_RETRY_ATTEMPTS,
  op: string
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      logger.warn(`${op} attempt ${i + 1} failed`, { error: e.message });
      if (i < attempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, i))
        ); // Exponential backoff
      }
    }
  }
  throw lastError || new Error(`${op} failed after ${attempts} attempts`);
}
