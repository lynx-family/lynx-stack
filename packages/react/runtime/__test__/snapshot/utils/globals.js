// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, expect, rstest } from '@rstest/core';

import { getJSModule } from './jsModule.ts';

const app = {
  callLepusMethod: rstest.fn(),
  markTiming: rstest.fn(),
  createJSObjectDestructionObserver: rstest.fn(() => {
    return {};
  }),
};

const native = {
  _listeners: {},
  onTriggerEvent: undefined,
  postMessage: rstest.fn((_message) => {}),
  addEventListener: rstest.fn((type, listener) => {
    if (!native._listeners[type]) {
      native._listeners[type] = [];
    }
    native._listeners[type].push(listener);
  }),
  removeEventListener: rstest.fn((type, listener) => {
    if (native._listeners[type]) {
      native._listeners[type] = native._listeners[type].filter(l => l !== listener);
    }
  }),
  dispatchEvent: rstest.fn((event) => {
    if (native._listeners[event.type]) {
      native._listeners[event.type].forEach(listener => listener(event));
    }
    return { canceled: false };
  }),
  _clear: () => {
    native._listeners = {};
    native.onTriggerEvent = undefined;
    native.postMessage.mockClear();
    native.addEventListener.mockClear();
    native.removeEventListener.mockClear();
    native.dispatchEvent.mockClear();
  },
};

const performance = {
  __functionCallHistory: [],
  _generatePipelineOptions: rstest.fn(() => {
    performance.__functionCallHistory.push(['_generatePipelineOptions']);
    return {
      pipelineID: 'pipelineID',
      needTimestamps: false,
    };
  }),
  _onPipelineStart: rstest.fn((id, options) => {
    if (typeof options === 'undefined') {
      performance.__functionCallHistory.push(['_onPipelineStart', id]);
    } else {
      performance.__functionCallHistory.push(['_onPipelineStart', id, options]);
    }
  }),
  _markTiming: rstest.fn((id, key) => {
    performance.__functionCallHistory.push(['_markTiming', id, key]);
  }),
  _bindPipelineIdWithTimingFlag: rstest.fn((id, flag) => {
    performance.__functionCallHistory.push(['_bindPipelineIdWithTimingFlag', id, flag]);
  }),

  profileStart: rstest.fn(),
  profileEnd: rstest.fn(),
  profileMark: rstest.fn(),
  profileFlowId: rstest.fn(() => 666),
  isProfileRecording: rstest.fn(() => true),
};

class SelectorQuery {
  static execLog = rstest.fn();
  id = '';
  method = '';
  params = undefined;

  select(id) {
    this.id = id;
    return this;
  }

  invoke(...args) {
    this.method = 'invoke';
    this.params = args;
    return this;
  }

  path(...args) {
    this.method = 'path';
    this.params = args;
    return this;
  }

  fields(...args) {
    this.method = 'fields';
    this.params = args;
    return this;
  }

  animate(...args) {
    this.method = 'animate';
    this.params = args;
    return this;
  }

  playAnimation(...args) {
    this.method = 'playAnimation';
    this.params = args;
    return this;
  }

  pauseAnimation(...args) {
    this.method = 'pauseAnimation';
    this.params = args;
    return this;
  }

  cancelAnimation(...args) {
    this.method = 'cancelAnimation';
    this.params = args;
    return this;
  }

  setNativeProps(...args) {
    this.method = 'setNativeProps';
    this.params = args;
    return this;
  }

  exec() {
    SelectorQuery.execLog(this.id, this.method, this.params);
  }
}

function injectGlobals() {
  globalThis.__DEV__ = true;
  globalThis.__PROFILE__ = true;
  globalThis.__ALOG__ = true;
  globalThis.__JS__ = true;
  globalThis.__LEPUS__ = true;
  globalThis.__BACKGROUND__ = true;
  globalThis.__MAIN_THREAD__ = true;
  globalThis.__REF_FIRE_IMMEDIATELY__ = false;
  globalThis.__ENABLE_SSR__ = true;
  globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  globalThis.__GLOBAL_PROPS_MODE__ = 'reactive';
  globalThis.globDynamicComponentEntry = '__Card__';
  globalThis.lynxCoreInject = {};
  globalThis.lynxCoreInject.tt = {
    GlobalEventEmitter: getJSModule('GlobalEventEmitter'),
  };
  globalThis.lynx = {
    queueMicrotask: Promise.prototype.then.bind(Promise.resolve()),
    getNativeApp: () => app,
    getNative: () => native,
    performance,
    createSelectorQuery: () => {
      return new SelectorQuery();
    },
    getJSModule,
    getElementByIdTasks: rstest.fn(),
    getElementById: rstest.fn((id) => {
      return {
        animate: rstest.fn(() => {
          lynx.getElementByIdTasks('animate');
          return {
            play: () => {
              lynx.getElementByIdTasks('play');
            },
            pause: () => {
              lynx.getElementByIdTasks('pause');
            },
            cancel: () => {
              lynx.getElementByIdTasks('cancel');
            },
          };
        }),
        setProperty: (property, value) => {
          lynx.getElementByIdTasks('setProperty', property, value);
        },
      };
    }),
  };
  globalThis.requestAnimationFrame = setTimeout;
  globalThis.cancelAnimationFrame = clearTimeout;

  globalThis.__SNAPSHOT__ = (snapshot) => {
    return snapshot.type;
  };

  console.profile = rstest.fn();
  console.profileEnd = rstest.fn();
  console.alog = rstest.fn();
}

beforeEach(() => {
  performance.profileStart.mockClear();
  performance.profileEnd.mockClear();
  native._clear();
});

afterEach((context) => {
  const skippedTasks = [
    // Skip preact/debug tests since it would throw errors and abort the rendering process
    'preact/debug',
    'should remove event listener when throw in cleanup',
    'should not throw if error - instead it will render an empty page',
  ];
  if (skippedTasks.some(task => context.task.name.includes(task))) {
    return;
  }

  expect(performance.profileStart.mock.calls.length).toBe(
    performance.profileEnd.mock.calls.length,
  );
});

injectGlobals();
