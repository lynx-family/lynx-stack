// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
(function() {
  'use strict';
  var g = (new Function('return this;'))();
  function __init_card_bundle__(lynxCoreInject) {
    g.__bundle__holder = undefined;
    var tt = lynxCoreInject.tt;
    tt.define('events-cache.js', function() {
      const btsExports = tt.require('background.js');
      const maybePromise = typeof btsExports === 'object'
        && btsExports !== null
        && typeof btsExports.then === 'function';

      if (!maybePromise) {
        console.warn(
          'events-cache.js: background.js exports is not a promise, skip events cache',
        );
        return;
      }

      let btsResolved = false;

      let cachedActions = [];

      // ensure tt._appInstance is initialized to avoid TTApp this._appInstance.onFirstScreen() fail
      tt._appInstance = tt._appInstance || Object.fromEntries(
        [
          'onLoad',
          'onReady',
          'onHide',
          'onShow',
          'onFirstScreen',
          'onError',
          'onDestroy',
        ].map(key => [key, (...args) => {
          cachedActions.push({
            type: 'appInstance',
            data: {
              type: key,
              args,
            },
          });
        }]),
      );

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
          if (btsResolved) {
            // biome-ignore lint/complexity/useOptionalChain: optional chain not supported here
            return methodsToOldFn[methodName]
              && methodsToOldFn[methodName](...args);
          }

          cachedActions.push({
            type: 'ttMethod',
            data: {
              type: methodName,
              args,
            },
          });
        };
      });

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
            cachedActions.push({
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

      btsExports
        .then(() => {
          btsResolved = true;

          methodsToMock.forEach(methodName => {
            // if DSL Framework does not inject new fn
            // we should restore to old fn
            if (tt[methodName] === methodsToMockFn[methodName]) {
              tt[methodName] = methodsToOldFn[methodName];
            }
          });

          // cleanup listeners
          while (cleanupTasks.length > 0) {
            cleanupTasks.shift()();
          }

          // replay cachedActions
          cachedActions.forEach(action => {
            if (action.type === 'appInstance') {
              tt._appInstance[action.data.type](...action.data.args);
            } else if (action.type === 'ttMethod') {
              tt[action.data.type](...action.data.args);
            } else if (action.type === 'performanceEvent') {
              const listenerKey = lynxPerformanceListenerKeys[action.data.type];
              if (listenerKey && emitter) {
                emitter.emit(listenerKey, action.data.args);
              }
            }
          });
        })
        .finally(() => {
          // cleanup listeners
          while (cleanupTasks.length > 0) {
            cleanupTasks.shift()();
          }
          cachedActions = [];
        });
    });
    return tt.require('events-cache.js');
  }
  // biome-ignore lint/complexity/useOptionalChain: optional chain not supported here
  if (g && g.bundleSupportLoadScript) {
    var res = { init: __init_card_bundle__ };
    g.__bundle__holder = res;
    return res;
  } else {
    // eslint-disable-next-line no-undef
    __init_card_bundle__({ 'tt': tt });
  }
})();
