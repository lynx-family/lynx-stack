// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
(function() {
  'use strict';
  var g = (new Function('return this;'))();
  function __init_card_bundle__(lynxCoreInject) {
    g.__bundle__holder = undefined;
    var tt = lynxCoreInject.tt;
    tt.define('lynx-core-inject-cache.js', function() {
      let ready = false;

      // ensure tt._appInstance is initialized to avoid TTApp this._appInstance.onFirstScreen() fail
      let cachedAppInstanceCalls = [];
      tt._appInstance = tt._appInstance || new Proxy({}, {
        get: function(_obj, prop) {
          if (prop === 'data') {
            return undefined;
          }

          return (...args) => {
            cachedAppInstanceCalls.push({
              type: prop,
              args,
            });
          };
        },
      });

      let cachedCalls = [];

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
          if (ready) {
            // biome-ignore lint/complexity/useOptionalChain: optional chain not supported here
            return methodsToOldFn[methodName]
              && methodsToOldFn[methodName](...args);
          }

          cachedCalls.push({
            type: methodName,
            args,
          });
        };
      });

      tt.onBackgroundThreadReady = () => {
        ready = true;

        methodsToMock.forEach(methodName => {
          // if DSL Framework does not inject new fn
          // we should restore to old fn
          if (tt[methodName] === methodsToMockFn[methodName]) {
            tt[methodName] = methodsToOldFn[methodName];
          }
        });

        // replay cachedAppInstanceCalls
        cachedAppInstanceCalls.forEach(call => {
          tt._appInstance[call.type](...call.args);
        });

        // replay cachedCalls
        cachedCalls.forEach(call => {
          tt[call.type](...call.args);
        });
      };
    });
    return tt.require('lynx-core-inject-cache.js');
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
