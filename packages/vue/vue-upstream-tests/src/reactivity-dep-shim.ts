/**
 * Shim for @vue/reactivity internal `../src/dep` imports.
 *
 * Most symbols are re-exported from the public API. A few internal-only
 * symbols (`targetMap`, `getDepFromReactive`) are stubbed — tests that
 * depend on their real behavior are skipped via the skiplist.
 */

export { ITERATE_KEY } from '@vue/reactivity';
export type { Dep } from '@vue/reactivity';

/** Stub — not part of the public API. Tests using this are skipped. */
export const targetMap = new WeakMap();

/** Stub — not part of the public API. Tests using this are skipped. */
export function getDepFromReactive(_obj: unknown, _key: string): undefined {
  return undefined;
}
