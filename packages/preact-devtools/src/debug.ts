/**
 * Will be tree-shaken out in prod builds
 */
export function debug(...args: any[]) {
  if (__DEBUG__) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}
