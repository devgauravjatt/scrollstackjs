/** A promise you can resolve/reject from the outside — for interleaving async in tests. */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A simple page shape used across tests: some items plus an optional cursor. */
export interface Page {
  readonly items: readonly number[];
  readonly cursor: number | null;
}
