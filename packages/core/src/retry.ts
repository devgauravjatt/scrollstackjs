import type { RetryValue, RetryDelayValue } from './types';

/** Retry up to 3 times by default. */
export const DEFAULT_RETRY: RetryValue = 3;

/** Exponential backoff, capped at 30s: 1s, 2s, 4s, 8s, ... */
export const DEFAULT_RETRY_DELAY: RetryDelayValue = (attempt) =>
  Math.min(1000 * 2 ** (attempt - 1), 30_000);

/**
 * Decides whether a fetch that has now failed `failureCount` times should be
 * retried again. `failureCount` is 1 on the first failure.
 */
export function resolveRetry(value: RetryValue, failureCount: number, error: unknown): boolean {
  if (typeof value === 'function') return value(failureCount, error);
  if (typeof value === 'boolean') return value;
  return failureCount <= value;
}

/** Resolves the delay (ms) before the next automatic retry. */
export function resolveRetryDelay(
  value: RetryDelayValue,
  failureCount: number,
  error: unknown,
): number {
  return typeof value === 'function' ? value(failureCount, error) : value;
}
