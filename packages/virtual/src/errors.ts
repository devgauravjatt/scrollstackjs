import { ScrollStackError } from '@scrollstackjs/core';

/**
 * Throws a {@link ScrollStackError} when `condition` is falsy.
 *
 * The error type is core's on purpose: one `instanceof` check should cover every
 * package in the constellation, and a second error class would only make callers
 * learn which package threw before they can catch it. It is the only thing this
 * package borrows from core at runtime — the virtualizer itself is standalone.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ScrollStackError(message);
}
