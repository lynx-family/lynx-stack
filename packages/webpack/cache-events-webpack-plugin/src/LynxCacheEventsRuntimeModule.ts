// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RuntimeModule } from 'webpack';

import { RuntimeGlobals as LynxRuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

type LynxCacheEventsRuntimeModule = new() => RuntimeModule;

export function createLynxCacheEventsRuntimeModule(
  webpack: typeof import('webpack'),
): LynxCacheEventsRuntimeModule {
  return class LynxCacheEventsRuntimeModule extends webpack.RuntimeModule {
    constructor() {
      super('Lynx cache events', webpack.RuntimeModule.STAGE_TRIGGER);
    }

    override generate(): string {
      const { RuntimeGlobals } = this.compilation!.compiler.webpack;

      return `// lynx cache events
const cleanupList = []
for (const { setup } of ${LynxRuntimeGlobals.lynxCacheEventsSetupList}) {
  cleanupList.push(setup());
}

const onLoaded = () => {
    ${LynxRuntimeGlobals.lynxCacheEvents}.loaded = true;
    
    for (const cleanup of cleanupList) {
      cleanup()
    }
    ${LynxRuntimeGlobals.lynxCacheEvents}.cachedActions = [];
  }
var next = ${RuntimeGlobals.startup};
${RuntimeGlobals.startup} = () => {
  return next().finally(onLoaded);
}

${LynxRuntimeGlobals.lynxCacheEvents}.loaded = false;
${LynxRuntimeGlobals.lynxCacheEvents}.cachedActions = [];
`;
    }
  };
}
