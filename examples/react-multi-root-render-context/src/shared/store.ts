declare global {
  var __sharedStoreInitCount__: number | undefined;
}

globalThis.__sharedStoreInitCount__ = (globalThis.__sharedStoreInitCount__ ?? 0)
  + 1;

export const initCount: number = globalThis.__sharedStoreInitCount__;

export const store: { clicks: number } = { clicks: 0 };

export function addClick(): number {
  return ++store.clicks;
}
