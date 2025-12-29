// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { EventEmitter } from 'node:events';

const ee = new EventEmitter();

__injectGlobals(globalThis);

function __injectGlobals(target) {
  target.__DEV__ = false;
  target.__LEPUS__ = false;
  target.__REF_FIRE_IMMEDIATELY__ = false;
  target.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  target.lynx = {
    getJSModule: (moduleName) => {
      if (moduleName === 'GlobalEventEmitter') {
        return ee;
      }
    },
  };
  target.lynxCoreInject = {};
  target.lynxCoreInject.tt = {};
  target.lynxCoreInject.tt.publicComponentEvent = () => void 0;
  target.lynxCoreInject.tt._params = { updateData: {} };
  target.__OnLifecycleEventQueue = [];
  target.__OnLifecycleEvent = args => {
    target.__OnLifecycleEventQueue.push(args);
  };
  target.lynx.createSelectorQuery = () => ({
    selectUniqueID: uid => ({ uid }),
  });
}
