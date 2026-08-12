/** Error type thrown by ScrollStack, so consumers can `instanceof` check it. */
export class ScrollStackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScrollStackError';
  }
}

/** Throws a {@link ScrollStackError} with `message` when `condition` is falsy. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ScrollStackError(message);
}

/** Human-readable description of an arbitrary value, for error messages. */
export function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'an array';
  return `a value of type "${typeof value}"`;
}

/** `true` when running in a DOM and `value` is an `Element`. */
export function isElement(value: unknown): value is Element {
  return typeof Element !== 'undefined' && value instanceof Element;
}
