// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Mimics a second physical copy of `@lynx-js/template-webpack-plugin` that
// would land at a separate node_modules path under npm hoist conflicts. It
// re-implements `getLynxTemplatePluginHooks` end-to-end so that *this* module
// instance has its own `createHooks` and its own module-level state — any
// successful cross-instance sharing must therefore happen through whatever
// shared slot the real implementation uses on `compilation`, not through
// accidental code identity.
import {
  AsyncSeriesBailHook,
  AsyncSeriesWaterfallHook,
  SyncWaterfallHook,
} from '@rspack/lite-tapable';

const LYNX_TEMPLATE_HOOKS_KEY = Symbol.for(
  '@lynx-js/template-webpack-plugin/hooks',
);

interface MinimalHooks {
  asyncChunkName: SyncWaterfallHook<unknown>;
  beforeEncode: AsyncSeriesWaterfallHook<unknown>;
  encode: AsyncSeriesBailHook<unknown, unknown>;
  beforeEmit: AsyncSeriesWaterfallHook<unknown>;
  afterEmit: AsyncSeriesWaterfallHook<unknown>;
}

function createHooks(): MinimalHooks {
  return {
    asyncChunkName: new SyncWaterfallHook(['pluginArgs']),
    beforeEncode: new AsyncSeriesWaterfallHook(['pluginArgs']),
    encode: new AsyncSeriesBailHook(['pluginArgs']),
    beforeEmit: new AsyncSeriesWaterfallHook(['pluginArgs']),
    afterEmit: new AsyncSeriesWaterfallHook(['pluginArgs']),
  };
}

export function getHooksFromSecondInstance(
  compilation: Record<symbol, unknown>,
): MinimalHooks {
  let hooks = compilation[LYNX_TEMPLATE_HOOKS_KEY] as MinimalHooks | undefined;
  if (hooks === undefined) {
    hooks = createHooks();
    compilation[LYNX_TEMPLATE_HOOKS_KEY] = hooks;
  }
  return hooks;
}
