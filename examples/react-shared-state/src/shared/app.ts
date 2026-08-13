// The cross-page "App" module. It lives in a shared chunk: with
// `enableSharedContextModules` on and both cards in one shared-context
// LynxGroup, this module is evaluated once per JS context and `globalData`
// is a single instance across pages.
const globalData = { count: 0 };

export function getApp(): { globalData: { count: number } } {
  return { globalData };
}

export function bump(page: string): number {
  globalData.count += 1;
  console.info(`[shared-app] bump from ${page}, count = ${globalData.count}`);
  return globalData.count;
}
