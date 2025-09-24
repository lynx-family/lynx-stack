// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RuntimeModule } from 'webpack';

import { RuntimeGlobals as LynxRuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import type { LynxCacheEventsPluginOptions } from './LynxCacheEventsPlugin.js';

type LynxCacheEventsSetupListRuntimeModule = new(
  setupListTransformer: NonNullable<
    LynxCacheEventsPluginOptions['setupListTransformer']
  >,
) => RuntimeModule;

export function createLynxCacheEventsSetupListRuntimeModule(
  webpack: typeof import('webpack'),
): LynxCacheEventsSetupListRuntimeModule {
  return class LynxCacheEventsSetupListRuntimeModule
    extends webpack.RuntimeModule
  {
    constructor(
      public setupListTransformer: NonNullable<
        LynxCacheEventsPluginOptions['setupListTransformer']
      >,
    ) {
      super('Lynx cache events setup list', webpack.RuntimeModule.STAGE_NORMAL);
    }

    override generate(): string {
      const { Template } = this.compilation!.compiler.webpack;

      return `// lynx cache events setup list
${LynxRuntimeGlobals.lynxCacheEvents} = {};
${LynxRuntimeGlobals.lynxCacheEventsSetupList} = ${
        Template.asString(
          '['
            + this.setupListTransformer([
              `{
      name: 'ttMethod',
      setup: () => {
        const tt = lynxCoreInject.tt;
        const methodsToMock = [
          'OnLifecycleEvent',
          'publishEvent',
          'publicComponentEvent',
          'callDestroyLifetimeFun',
          'updateGlobalProps',
          'updateCardData',
          'onAppReload',
          'processCardConfig',
        ];
        const methodsToOldFn = {};
        const methodsToMockFn = {};

        methodsToMock.forEach(methodName => {
          // biome-ignore lint/complexity/useOptionalChain: optional chain not supported here
          methodsToOldFn[methodName] = tt[methodName] && tt[methodName].bind(tt);
          tt[methodName] = methodsToMockFn[methodName] = (...args) => {
            if (${LynxRuntimeGlobals.lynxCacheEvents}.loaded) {
              // biome-ignore lint/complexity/useOptionalChain: optional chain not supported here
              return methodsToOldFn[methodName]
                && methodsToOldFn[methodName](...args);
            }

            ${LynxRuntimeGlobals.lynxCacheEvents}.cachedActions.push({
              type: 'ttMethod',
              data: {
                type: methodName,
                args,
              },
            });
          };
        });
        
        return () => {
          ${LynxRuntimeGlobals.lynxCacheEvents}.cachedActions.forEach(action => {
            if (action.type === 'ttMethod') {
              tt[action.data.type](...action.data.args);
            }
          });
        }
      },
    }`,
              `{
      name: 'performanceEvent',
      setup: () => {
          const tt = lynxCoreInject.tt;
          const lynxPerformanceListenerKeys = {
            onPerformance: 'lynx.performance.onPerformanceEvent',
            onSetup: 'lynx.performance.timing.onSetup',
            onUpdate: 'lynx.performance.timing.onUpdate',
          };
          const emitter = tt.GlobalEventEmitter;
          let cleanupTasks = [];
          if (emitter) {
            Object.keys(lynxPerformanceListenerKeys).forEach(key => {
            const listenerKey = lynxPerformanceListenerKeys[key];
            const listener = (...args) => {
              ${LynxRuntimeGlobals.lynxCacheEvents}.cachedActions.push({
                type: 'performanceEvent',
                data: {
                  type: key,
                  args,
                },
              });
            };
            emitter.addListener(listenerKey, listener);
            cleanupTasks.push(() => {
              emitter.removeListener(listenerKey, listener);
            });
          });
        }
        
        return () => {
          // cleanup listeners
          while (cleanupTasks.length > 0) {
            cleanupTasks.shift()();
          }
          // replay ${LynxRuntimeGlobals.lynxCacheEvents}.cachedActions
          ${LynxRuntimeGlobals.lynxCacheEvents}.cachedActions.forEach(action => {
            if (action.type === 'performanceEvent') {
              const listenerKey = lynxPerformanceListenerKeys[action.data.type];
              if (listenerKey && emitter) {
                emitter.emit(listenerKey, action.data.args);
              }
            }
          });
        }
      }
    }`,
            ]).join(',')
            + ']',
        )
      };

`;
    }
  };
}
