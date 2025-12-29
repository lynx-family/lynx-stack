export type JSRealm = {
  globalWindow: typeof globalThis;
  loadScript: (url: string) => Promise<unknown>;
  loadScriptSync: (url: string) => unknown;
};
