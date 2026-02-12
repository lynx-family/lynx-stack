// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

export const isProfiling: boolean = Boolean(
  (typeof __PROFILE__ !== 'undefined' && __PROFILE__) || lynx.performance?.isProfileRecording?.(),
);
if (isProfiling && typeof __PROFILE__ === 'undefined') {
  // @ts-expect-error mock profile
  globalThis.__PROFILE__ = true;
}

const noop = () => {};
const noopFlowId = () => 0;

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

export const profileFlowId = /* @__PURE__ */ ((() => {
  let p;
  if (!(p = lynx.performance) || typeof p.profileFlowId !== 'function') {
    return noopFlowId;
  }
  return p.profileFlowId.bind(p);
})()) as typeof lynx.performance.profileFlowId;
