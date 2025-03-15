const UA = window.navigator.userAgent;
export const isChromium = UA.includes('Chrome');
export const isWebkit = /\b(iPad|iPhone|iPod|OS X)\b/.test(UA)
  && !/Edge/.test(UA)
  && /WebKit/.test(UA)
  // @ts-expect-error
  && !window.MSStream;
