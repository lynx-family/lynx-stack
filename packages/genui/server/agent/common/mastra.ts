// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';

const A2UI_MASTRA_RUNTIME = Symbol.for(
  '@lynx-js/genui-server/a2ui-mastra-runtime',
);

type GlobalWithA2UIMastra = typeof globalThis & {
  [A2UI_MASTRA_RUNTIME]?: Mastra;
};

export function getA2UIMastra(): Mastra {
  const globalScope = globalThis as GlobalWithA2UIMastra;
  globalScope[A2UI_MASTRA_RUNTIME] ??= new Mastra({
    logger: false,
    storage: new InMemoryStore({ id: 'a2ui-server' }),
  });
  return globalScope[A2UI_MASTRA_RUNTIME];
}
