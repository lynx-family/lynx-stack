import EventEmitter from 'events';
import { createGlobalThis, LynxGlobalThis } from './lynx/GlobalThis';
import { initElementTree, initNativeMethodQueue } from './lynx/nativeMethod';
import { VirtualConsole } from './lynx/virtual-console';
export type { LynxFiberElement } from './lynx/nativeMethod';

type ElementTree = ReturnType<typeof initElementTree>;
type FilterUnderscoreKeys<T> = {
  [K in keyof T]: K extends `__${string}` ? K : never;
}[keyof T];
type PickUnderscoreKeys<T> = Pick<T, FilterUnderscoreKeys<T>>;
type ElementTreeGlobals = PickUnderscoreKeys<ElementTree>;

declare global {
  var lynxDOM: LynxDOM;
  var elementTree: ElementTree;
  var __JS__: boolean;
  var __LEPUS__: boolean;

  namespace lynxCoreInject {
    var tt: any;
  }

  function onInjectBackgroundThreadGlobals(globals: any): void;
  function onInjectMainThreadGlobals(globals: any): void;
  function onSwitchedToBackgroundThread(): void;
  function onSwitchedToMainThread(): void;
  function onResetLynxEnv(): void;
  function onInitWorkletRuntime(): void;

  var global: ElementTreeGlobals & typeof globalThis;
}

export function __injectElementApi(target?: any) {
  const elementTree = initElementTree();
  target.elementTree = elementTree;
  const nativeMethodQueue = initNativeMethodQueue();

  function withQueue<T>(
    name: string,
    fn: (this: T, ...args: any[]) => any,
  ) {
    return function(this: T, ...args: any[]) {
      nativeMethodQueue.push([name, args]);
      return fn.apply(this, args);
    };
  }

  if (typeof target === 'undefined') {
    target = globalThis;
  }

  for (
    const k of Object.getOwnPropertyNames(elementTree.constructor.prototype)
  ) {
    if (k.startsWith('__')) {
      // @ts-ignore
      target[k] = withQueue(k, elementTree[k].bind(elementTree));
    }
  }

  target.$kTemplateAssembler = {};

  target.registerDataProcessor = () => {
    console.error('registerDataProcessor is not implemented');
  };

  target.__OnLifecycleEvent = (...args: any[]) => {
    const isMainThread = __LEPUS__;

    globalThis.lynxDOM.switchToBackgroundThread();
    globalThis.lynxCoreInject.tt.OnLifecycleEvent(...args);

    if (isMainThread) {
      globalThis.lynxDOM.switchToMainThread();
    }
  };
  target._ReportError = () => {};
}

function createPolyfills() {
  const app = {
    callLepusMethod: (...rLynxChange: any[]) => {
      const isBackground = !__LEPUS__;

      globalThis.lynxDOM.switchToMainThread();
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();

      // restore the original thread state
      if (isBackground) {
        globalThis.lynxDOM.switchToBackgroundThread();
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
    const isMainThread = __LEPUS__;
    lynxDOM.switchToBackgroundThread();

    // Ensure the code is running on the background thread
    ee.emit(type, {
      data: data,
    });

    if (isMainThread) {
      lynxDOM.switchToMainThread();
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
    const isBackground = !__LEPUS__;
    globalThis.lynxDOM.switchToMainThread();

    if (process.env.DEBUG) {
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
      globalThis.lynxDOM.switchToBackgroundThread();
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

export function injectMainThreadGlobals(target?: any, polyfills?: any) {
  __injectElementApi(target);

  const {
    performance,
    CoreContext,
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
  target.__REF_FIRE_IMMEDIATELY__ = false;
  target.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  target.__TESTING_FORCE_RENDER_TO_OPCODE__ = false;
  target.globDynamicComponentEntry = '__Card__';
  target.lynx = {
    performance,
    // getCoreContext: (() => CoreContext),
    getJSContext: (() => JsContext),
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

export function injectBackgroundThreadGlobals(target?: any, polyfills?: any) {
  const {
    app,
    performance,
    CoreContext,
    JsContext,
    __LoadLepusChunk,
  } = polyfills || {};
  if (typeof target === 'undefined') {
    target = globalThis;
  }

  target.__DEV__ = true;
  target.__PROFILE__ = true;
  target.__JS__ = true;
  target.__LEPUS__ = false;
  target.globDynamicComponentEntry = '__Card__';
  target.lynxCoreInject = {};
  target.lynxCoreInject.tt = {
    _params: {
      initData: {},
      updateData: {},
    },
  };

  class NodesRef {
    private readonly _nodeSelectToken: any;
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
  const enum IdentifierType {
    ID_SELECTOR, // css selector
    REF_ID, // for react ref
    UNIQUE_ID, // element_id
  }

  const globalEventEmiter = new EventEmitter();
  // @ts-ignore
  globalEventEmiter.trigger = globalEventEmiter.emit;
  // @ts-ignore
  globalEventEmiter.toggle = globalEventEmiter.emit;
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
    // getJSContext: (() => JsContext),
    getJSModule: (moduleName) => {
      if (moduleName === 'GlobalEventEmitter') {
        return globalEventEmiter;
      } else {
        throw new Error(`getJSModule(${moduleName}) not implemented`);
      }
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

export type ThreadType = 'background' | 'main';

export class LynxDOM {
  private originals: Map<string, any> = new Map();
  backgroundThread: LynxGlobalThis;
  mainThread: LynxGlobalThis & ElementTreeGlobals;
  constructor() {
    const virtualConsole = console && global.console
      ? new VirtualConsole().sendTo(global.console)
      : undefined;

    this.backgroundThread = createGlobalThis({
      virtualConsole,
    }) as any;
    this.mainThread = createGlobalThis({
      virtualConsole,
    }) as any;

    this.injectGlobals();

    // we have to switch background thread first
    // otherwise global import for @lynx-js/react will report error
    // on __LEPUS__/__JS__/lynx not defined etc.
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
  // otherwise we will get error on __LEPUS__/__JS__/lynx not defined etc.
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
