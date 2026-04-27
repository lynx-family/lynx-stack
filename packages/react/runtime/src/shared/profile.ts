// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* v8 ignore start */
const noop: (...args: unknown[]) => unknown = () => {};
const noopFlowId = () => 0;
/* v8 ignore end */

export const isProfiling: boolean = /* @__PURE__ */ Boolean(
  lynx.performance?.isProfileRecording?.(),
);

export const profileStart = /* @__PURE__ */ ((() => {
  let p;
  if (!(p = lynx.performance) || typeof p.profileStart !== 'function') {
    return noop;
  }
  return p.profileStart.bind(p);
})()) as typeof lynx.performance.profileStart;

export const profileEnd = /* @__PURE__ */ ((() => {
  let p;
  if (!(p = lynx.performance) || typeof p.profileEnd !== 'function') {
    return noop;
  }
  return p.profileEnd.bind(p);
})()) as typeof lynx.performance.profileEnd;

export const profileFlowId: typeof lynx.performance.profileFlowId = /* @__PURE__ */ (() => {
  let p;
  if (!(p = lynx.performance) || typeof p.profileFlowId !== 'function') {
    return noopFlowId;
  }
  return p.profileFlowId.bind(p);
})();
