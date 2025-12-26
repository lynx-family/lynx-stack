// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type BTSChunkEntry = (
  postMessage: undefined,
  module: { exports: unknown },
  exports: unknown,
  lynxCoreInject: unknown,
  Card: unknown,
  setTimeout: unknown,
  setInterval: unknown,
  clearInterval: unknown,
  clearTimeout: unknown,
  NativeModules: unknown,
  Component: unknown,
  ReactLynx: unknown,
  nativeAppId: unknown,
  Behavior: unknown,
  LynxJSBI: unknown,
  lynx: unknown,
  // BOM API
  window: unknown,
  document: unknown,
  frames: unknown,
  location: unknown,
  navigator: unknown,
  localStorage: unknown,
  history: unknown,
  Caches: unknown,
  screen: unknown,
  alert: unknown,
  confirm: unknown,
  prompt: unknown,
  fetch: unknown,
  XMLHttpRequest: unknown,
  webkit: unknown,
  Reporter: unknown,
  print: unknown,
  global: unknown,
  // Lynx API
  requestAnimationFrame: unknown,
  cancelAnimationFrame: unknown,
) => unknown;
