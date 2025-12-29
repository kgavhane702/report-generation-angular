/**
 * Deep clone helper for plain data objects (POJOs) used in document/widget models.
 *
 * Uses `structuredClone` when available (browser + modern Node), otherwise falls back
 * to JSON serialization (works for our plain models: no functions, Dates, Maps, etc).
 */
export function deepClone<T>(value: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (globalThis as any)?.structuredClone as ((v: unknown) => unknown) | undefined;
  if (typeof sc === 'function') {
    return sc(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}


