// The cross-page "App" module. It lives in a shared chunk: with
// `enableSharedContextModules` on and both cards in one shared-context
// LynxGroup, this module is evaluated once per JS context and `globalData`
// is a single instance across pages.
const globalData = { count: 0 };

// Captured at module scope by the FIRST card that evaluates this chunk.
// With the App-runtime globals these stay valid after that card dies —
// exactly the Promise / setTimeout leak this demo verifies.
const captureTimeSetTimeout = setTimeout;
const CapturedPromise = Promise;

export function getApp(): { globalData: { count: number } } {
  return { globalData };
}

export function bump(page: string): number {
  globalData.count += 1;
  console.info(`[shared-app] bump from ${page}, count = ${globalData.count}`);
  return globalData.count;
}

/**
 * Bumps after 1.5s through the module-scope-captured timer wrapped in a
 * module-scope-captured Promise. If either is still bound to the first
 * card and that card is gone, this never resolves; with App-runtime
 * globals it settles no matter which cards are still alive.
 */
export function bumpAsync(page: string): Promise<number> {
  return new CapturedPromise<number>((resolve) => {
    captureTimeSetTimeout(() => {
      resolve(bump(`${page} (async)`));
    }, 1500);
  });
}
