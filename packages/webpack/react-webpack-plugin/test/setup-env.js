// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { EventEmitter } from 'node:events';
import {
  clearInterval,
  clearTimeout,
  setInterval,
  setTimeout,
} from 'node:timers';

__injectGlobals(globalThis);

function __injectGlobals(target) {
  target.__DEV__ = false;
  target.__LEPUS__ = false;
  target.__MAIN_THREAD__ = false;
  target.__REF_FIRE_IMMEDIATELY__ = false;
  target.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  target.__GLOBAL_PROPS_MODE__ = 'reactive';
  const events = new EventEmitter();
  const jsContext = {
    addEventListener: (type, listener) => events.on(type, listener),
    removeEventListener: (type, listener) => events.off(type, listener),
    dispatchEvent: event => events.emit(event.type, event),
  };
  target.lynx = {
    getJSContext: () => jsContext,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    requestAnimationFrame: callback =>
      setTimeout(() => callback(performance.now()), 16),
    cancelAnimationFrame: clearTimeout,
  };
  target.lynxCoreInject = {};
  target.lynxCoreInject.tt = {};
  target.lynx.getApp = () => target.lynxCoreInject.tt;
  target.lynxCoreInject.tt.publicComponentEvent = () => void 0;
  target.lynxCoreInject.tt._params = { updateData: {} };
  target.lynxCoreInject.tt._nativeApp = {
    nativeModuleProxy: {},
  };
  target.__OnLifecycleEventQueue = [];
  target.__OnLifecycleEvent = args => {
    target.__OnLifecycleEventQueue.push(args);
  };
  target.lynx.createSelectorQuery = () => ({
    selectUniqueID: uid => ({ uid }),
  });
}
