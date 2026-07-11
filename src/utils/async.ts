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
  let timeoutId: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${op} timed out after ${ms}ms`)), ms);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
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
        let retryTimeoutId: NodeJS.Timeout;
        await new Promise((resolve) => {
          retryTimeoutId = setTimeout(resolve, 1000 * Math.pow(2, i));
        }).finally(() => {
          if (retryTimeoutId) clearTimeout(retryTimeoutId);
        }); // Exponential backoff
      }
    }
  }
  throw lastError || new Error(`${op} failed after ${attempts} attempts`);
}
