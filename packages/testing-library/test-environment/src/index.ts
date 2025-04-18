/**
 * @packageDocumentation
 *
 * A pure-JavaScript implementation of the {@link https://lynxjs.org/guide/spec.html | Lynx Spec},
 * notably the {@link https://lynxjs.org/api/engine/element-api | Element PAPI} and {@link https://lynxjs.org/guide/spec#dual-threaded-model | Dual-threaded Model} for use with Node.js.
 */

import EventEmitter from 'events';
import { JSDOM } from 'jsdom';
import { createGlobalThis, LynxGlobalThis } from './lynx/GlobalThis';
import { initElementTree } from './lynx/ElementPAPI';
export { initElementTree } from './lynx/ElementPAPI';
export type { LynxElement } from './lynx/ElementPAPI';
export type { LynxGlobalThis } from './lynx/GlobalThis';
/**
 * @public
 * The lynx element tree
 */
export type ElementTree = ReturnType<typeof initElementTree>;
/**
 * @public
 */
export type FilterUnderscoreKeys<T> = {
  [K in keyof T]: K extends `__${string}` ? K : never;
}[keyof T];
/**
 * @public
 */
export type PickUnderscoreKeys<T> = Pick<T, FilterUnderscoreKeys<T>>;
/**
 * The Element PAPI Types
 * @public
 */
export type ElementTreeGlobals = PickUnderscoreKeys<ElementTree>;

declare global {
  var lynxEnv: LynxEnv;
  var elementTree: ElementTree;
  var __JS__: boolean;
  var __LEPUS__: boolean;
  var __BACKGROUND__: boolean;
  var __MAIN_THREAD__: boolean;

  namespace lynxCoreInject {
    var tt: any;
  }

  function onInjectBackgroundThreadGlobals(globals: any): void;
  function onInjectMainThreadGlobals(globals: any): void;
  function onSwitchedToBackgroundThread(): void;
  function onSwitchedToMainThread(): void;
  function onResetLynxEnv(): void;
  function onInitWorkletRuntime(): void;
}

function __injectElementApi(target?: any) {
  const elementTree = initElementTree();
  target.elementTree = elementTree;

  if (typeof target === 'undefined') {
    target = globalThis;
  }

  for (
    const k of Object.getOwnPropertyNames(elementTree.constructor.prototype)
  ) {
    if (k.startsWith('__')) {
      // @ts-ignore
      target[k] = elementTree[k].bind(elementTree);
    }
  }

  target.$kTemplateAssembler = {};

  target.registerDataProcessor = () => {
    console.error('registerDataProcessor is not implemented');
  };

  target.__OnLifecycleEvent = (...args: any[]) => {
    const isMainThread = __MAIN_THREAD__;

    globalThis.lynxEnv.switchToBackgroundThread();
    globalThis.lynxCoreInject.tt.OnLifecycleEvent(...args);

    if (isMainThread) {
      globalThis.lynxEnv.switchToMainThread();
    }
  };
  target._ReportError = () => {};
}

function createPolyfills() {
  const app = {
    callLepusMethod: (...rLynxChange: any[]) => {
      const isBackground = !__MAIN_THREAD__;

      globalThis.lynxEnv.switchToMainThread();
      globalThis[rLynxChange[0]](rLynxChange[1]);

      globalThis.lynxEnv.switchToBackgroundThread();
      rLynxChange[2]();
      globalThis.lynxEnv.switchToMainThread();

      // restore the original thread state
      if (isBackground) {
        globalThis.lynxEnv.switchToBackgroundThread();
      }
    },
    markTiming: () => {},
    createJSObjectDestructionObserver: (() => {
      return {};
    }),
  };

  const performance = {
    __functionCallHistory: [] as any[],
    _generatePipelineOptions: (() => {
      performance.__functionCallHistory.push(['_generatePipelineOptions']);
      return {
        pipelineID: 'pipelineID',
        needTimestamps: false,
      };
    }),
    _onPipelineStart: ((id) => {
      performance.__functionCallHistory.push(['_onPipelineStart', id]);
    }),
    _markTiming: ((id, key) => {
      performance.__functionCallHistory.push(['_markTiming', id, key]);
    }),
    _bindPipelineIdWithTimingFlag: ((id, flag) => {
      performance.__functionCallHistory.push([
        '_bindPipelineIdWithTimingFlag',
        id,
        flag,
      ]);
    }),
  };

  const ee = new EventEmitter();
  // @ts-ignore
  ee.dispatchEvent = ({
    type,
    data,
  }) => {
    const isMainThread = __MAIN_THREAD__;
    lynxEnv.switchToBackgroundThread();

    // Ensure the code is running on the background thread
    ee.emit(type, {
      data: data,
    });

    if (isMainThread) {
      lynxEnv.switchToMainThread();
    }
  };
  // @ts-ignore
  ee.addEventListener = ee.addListener;
  // @ts-ignore
  ee.removeEventListener = ee.removeListener;

  const CoreContext = ee;

  const JsContext = ee;

  function __LoadLepusChunk(
    chunkName: string,
    options,
  ) {
    const isBackground = !__MAIN_THREAD__;
    globalThis.lynxEnv.switchToMainThread();

    if (process.env['DEBUG']) {
      console.log('__LoadLepusChunk', chunkName, options);
    }
    let ans;
    if (chunkName === 'worklet-runtime') {
      ans = globalThis.onInitWorkletRuntime?.();
    } else {
      throw new Error(`__LoadLepusChunk: Unknown chunk name: ${chunkName}`);
    }

    // restore the original thread state
    if (isBackground) {
      globalThis.lynxEnv.switchToBackgroundThread();
    }

    return ans;
  }

  return {
    app,
    performance,
    CoreContext,
    JsContext,
    __LoadLepusChunk,
  };
}

function injectMainThreadGlobals(target?: any, polyfills?: any) {
  __injectElementApi(target);

  const {
    performance,
    JsContext,
    __LoadLepusChunk,
  } = polyfills || {};
  if (typeof target === 'undefined') {
    target = globalThis;
  }

  target.__DEV__ = true;
  target.__PROFILE__ = true;
  target.__JS__ = false;
  target.__LEPUS__ = true;
  target.__BACKGROUND__ = false;
  target.__MAIN_THREAD__ = true;
  target.__REF_FIRE_IMMEDIATELY__ = false;
  target.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  target.__TESTING_FORCE_RENDER_TO_OPCODE__ = false;
  target.__ENABLE_SSR__ = false;
  target.globDynamicComponentEntry = '__Card__';
  target.lynx = {
    performance,
    getJSContext: (() => JsContext),
    reportError: (e: Error) => {
      throw e;
    },
  };
  target.requestAnimationFrame = setTimeout;
  target.cancelAnimationFrame = clearTimeout;

  target.console.profile = () => {};
  target.console.profileEnd = () => {};

  target.__LoadLepusChunk = __LoadLepusChunk;

  globalThis.onInjectMainThreadGlobals?.(target);
}

const IGNORE_LIST_GLOBALS = [
  'globalThis',
  'global',
];

class NodesRef {
  // @ts-ignore
  private readonly _nodeSelectToken: any;
  // @ts-ignore
  private readonly _selectorQuery: any;

  constructor(selectorQuery: any, nodeSelectToken: any) {
    this._nodeSelectToken = nodeSelectToken;
    this._selectorQuery = selectorQuery;
  }
  invoke() {
    throw new Error('not implemented');
  }
  path() {
    throw new Error('not implemented');
  }
  fields() {
    throw new Error('not implemented');
  }
  setNativeProps() {
    throw new Error('not implemented');
  }
}

function injectBackgroundThreadGlobals(target?: any, polyfills?: any) {
  const {
    app,
    performance,
    CoreContext,
    __LoadLepusChunk,
  } = polyfills || {};
  if (typeof target === 'undefined') {
    target = globalThis;
  }

  target.__DEV__ = true;
  target.__PROFILE__ = true;
  target.__JS__ = true;
  target.__LEPUS__ = false;
  target.__BACKGROUND__ = true;
  target.__MAIN_THREAD__ = false;
  target.__ENABLE_SSR__ = false;
  target.globDynamicComponentEntry = '__Card__';
  target.lynxCoreInject = {};
  target.lynxCoreInject.tt = {
    _params: {
      initData: {},
      updateData: {},
    },
  };

  const enum IdentifierType {
    ID_SELECTOR, // css selector
    REF_ID, // for react ref
    UNIQUE_ID, // element_id
  }

  const globalEventEmitter = new EventEmitter();
  // @ts-ignore
  globalEventEmitter.trigger = globalEventEmitter.emit;
  // @ts-ignore
  globalEventEmitter.toggle = globalEventEmitter.emit;
  target.lynx = {
    getNativeApp: () => app,
    performance,
    createSelectorQuery: (() => {
      return {
        selectUniqueID: function(uniqueId: number) {
          return new NodesRef({}, {
            type: IdentifierType.UNIQUE_ID,
            identifier: uniqueId.toString(),
          });
        },
      };
    }),
    getCoreContext: (() => CoreContext),
    getJSModule: (moduleName) => {
      if (moduleName === 'GlobalEventEmitter') {
        return globalEventEmitter;
      } else {
        throw new Error(`getJSModule(${moduleName}) not implemented`);
      }
    },
    reportError: (e: Error) => {
      throw e;
    },
  };
  target.requestAnimationFrame = setTimeout;
  target.cancelAnimationFrame = clearTimeout;

  target.console.profile = () => {};
  target.console.profileEnd = () => {};

  // TODO: user-configurable
  target.SystemInfo = {
    'platform': 'iOS',
    'pixelRatio': 3,
    'pixelWidth': 1170,
    'pixelHeight': 2532,
    'osVersion': '17.0.2',
    'enableKrypton': true,
    'runtimeType': 'quickjs',
    'lynxSdkVersion': '3.0',
  };

  target.__LoadLepusChunk = __LoadLepusChunk;

  globalThis.onInjectBackgroundThreadGlobals?.(target);
}

/**
 * A pure-JavaScript implementation of the {@link https://lynxjs.org/guide/spec.html | Lynx Spec},
 * notably the {@link https://lynxjs.org/api/engine/element-api | Element PAPI} and {@link https://lynxjs.org/guide/spec#dual-threaded-model | Dual-threaded Model} for use with Node.js.
 *
 * @example
 *
 * ```ts
 * import { LynxEnv } from '@lynx-js/test-environment';
 *
 * const lynxEnv = new LynxEnv();
 *
 * lynxEnv.switchToMainThread();
 * // use the main thread Element PAPI
 * const page = __CreatePage('0', 0);
 * const view = __CreateView(0);
 * __AppendElement(page, view);
 *
 * ```
 *
 * @public
 */
export class LynxEnv {
  private originals: Map<string, any> = new Map();
  /**
   * The global object for the background thread.
   *
   * @example
   *
   * ```ts
   * import { LynxEnv } from '@lynx-js/test-environment';
   *
   * const lynxEnv = new LynxEnv();
   *
   * lynxEnv.switchToBackgroundThread();
   * // use the background thread global object
   * globalThis.lynxCoreInject.tt.OnLifecycleEvent(...args);
   * ```
   */
  backgroundThread: LynxGlobalThis;
  /**
   * The global object for the main thread.
   *
   * @example
   *
   * ```ts
   * import { LynxEnv } from '@lynx-js/test-environment';
   *
   * const lynxEnv = new LynxEnv();
   *
   * lynxEnv.switchToMainThread();
   * // use the main thread global object
   * const page = globalThis.__CreatePage('0', 0);
   * const view = globalThis.__CreateView(0);
   * globalThis.__AppendElement(page, view);
   * ```
   */
  mainThread: LynxGlobalThis & ElementTreeGlobals;
  jsdom: JSDOM = global.jsdom;
  constructor() {
    this.backgroundThread = createGlobalThis() as any;
    this.mainThread = createGlobalThis() as any;

    const globalPolyfills = {
      console: this.jsdom.window['console'],
      // `Event` is required by `fireEvent` in `@testing-library/dom`
      Event: this.jsdom.window.Event,
      // `window` is required by `getDocument` in `@testing-library/dom`
      window: this.jsdom.window,
      // `document` is required by `screen` in `@testing-library/dom`
      document: this.jsdom.window.document,
    };

    Object.assign(
      this.mainThread.globalThis,
      globalPolyfills,
    );
    Object.assign(
      this.backgroundThread.globalThis,
      globalPolyfills,
    );

    this.injectGlobals();

    // we have to switch background thread first
    // otherwise global import for @lynx-js/react will report error
    // on __MAIN_THREAD__/__BACKGROUND__/lynx not defined etc.
    this.switchToBackgroundThread();
  }

  injectGlobals() {
    const polyfills = createPolyfills();
    injectBackgroundThreadGlobals(this.backgroundThread.globalThis, polyfills);
    injectMainThreadGlobals(this.mainThread.globalThis, polyfills);
  }

  switchToBackgroundThread() {
    this.originals = new Map();
    Object.getOwnPropertyNames(this.backgroundThread.globalThis).forEach(
      (key) => {
        if (IGNORE_LIST_GLOBALS.includes(key)) {
          return;
        }
        this.originals.set(key, global[key]);
        global[key] = this.backgroundThread.globalThis[key];
      },
    );

    globalThis?.onSwitchedToBackgroundThread?.();
  }
  switchToMainThread() {
    this.originals = new Map();
    Object.getOwnPropertyNames(this.mainThread.globalThis).forEach((key) => {
      if (IGNORE_LIST_GLOBALS.includes(key)) {
        return;
      }
      this.originals.set(key, global[key]);
      global[key] = this.mainThread.globalThis[key];
    });

    globalThis?.onSwitchedToMainThread?.();
  }
  // we do not use it because we have to keep background thread
  // otherwise we will get error on __MAIN_THREAD__/__BACKGROUND__/lynx not defined etc.
  clearGlobal() {
    this.originals?.forEach((v, k) => {
      global[k] = v;
    });
    this.originals?.clear();
  }
  resetLynxEnv() {
    this.injectGlobals();
    // ensure old globals are replaced with new globals
    this.switchToMainThread();
    this.switchToBackgroundThread();
    globalThis.onResetLynxEnv?.();
  }
}
