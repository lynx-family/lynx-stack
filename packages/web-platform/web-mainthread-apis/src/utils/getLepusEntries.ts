// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxJSModule, LynxTemplate } from '@lynx-js/web-constants';

export const getLepusEntries = async (
  lepusCode: LynxTemplate['lepusCode'],
  moduleCache: Record<string, LynxJSModule>,
) => {
  const lepusCodeEntries = await Promise.all(
    Object.entries(lepusCode).map(async ([name, url]) => {
      const cachedModule = moduleCache[url];
      if (cachedModule) {
        return [name, cachedModule] as [string, LynxJSModule];
      } else {
        Object.assign(globalThis, { module: {} });
        await import(/* webpackIgnore: true */ url);
        const module = globalThis.module as LynxJSModule;
        Object.assign(globalThis, { module: {} });
        moduleCache[url] = module;
        return [name, module] as [string, LynxJSModule];
      }
    }),
  );
  const lepusEntries = Object.fromEntries(lepusCodeEntries);
  const entry = lepusEntries['root']!.exports;
  return { lepusEntries, entry };
};
