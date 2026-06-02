// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable */

import { Component } from 'preact';

import { globalCommitContext } from './commit-context.js';
import { PerfSpecificKey, markTimingLegacy } from './performance.js';
import { NEXT_STATE } from '../shared/render-constants.js';

interface ReactAppInstance {
  GlobalEventEmitter: unknown;
  registerModule(name: string, module: object): void;
  getJSModule<Module = unknown>(name: string): Module;
}

interface LegacyNativeApp {
  nativeModuleProxy: {
    LynxUIMethodModule: unknown;
  };
}

interface LegacyReactComponent {
  getNodeRef(this: unknown, selector: string, single?: boolean): unknown;
  getNodeRefFromRoot(this: unknown, selector: string): unknown;
}

const OriginalSetStateKey = '__reactLynxOriginalSetState';

function reportRefDeprecationError(fnName: string, newFnName: string) {
  if (__DEV__ && !__DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__) {
    lynx.reportError(
      new Error(
        `${fnName} is deprecated and has different behavior in ReactLynx 3.0, please use ref or ${newFnName} instead.`,
      ),
    );
  }
}

function getReactAppInstance(): ReactAppInstance {
  return lynxCoreInject.tt as unknown as ReactAppInstance;
}

function getLegacyNativeApp(): LegacyNativeApp {
  return (lynxCoreInject.tt as any)._nativeApp;
}

function getLegacyReactComponent(): LegacyReactComponent {
  return (lynxCoreInject.tt as any)._reactLynx.ReactComponent.prototype;
}

function createLegacyComponentReceiver(
  reactAppInstance: ReactAppInstance,
  nativeApp: LegacyNativeApp,
): unknown {
  return {
    _type: '',
    _nativeApp: nativeApp,
    _uiModule: nativeApp.nativeModuleProxy.LynxUIMethodModule,
    _reactAppInstance: reactAppInstance,
  };
}

function installComponentCompat(): void {
  if (!__JS__) {
    return;
  }

  const __Component = Component as any;
  const reactAppInstance = getReactAppInstance();

  __Component.prototype._reactAppInstance = reactAppInstance;

  __Component.prototype.getNodeRef = function(a: string, b?: boolean) {
    reportRefDeprecationError('getNodeRef', 'lynx.createSelectorQuery');

    return getLegacyReactComponent().getNodeRef.call(
      createLegacyComponentReceiver(
        getReactAppInstance(),
        getLegacyNativeApp(),
      ),
      a,
      b,
    );
  };

  __Component.prototype.getNodeRefFromRoot = function(a: string) {
    reportRefDeprecationError('getNodeRefFromRoot', 'lynx.createSelectorQuery');

    return getLegacyReactComponent().getNodeRefFromRoot.call(
      createLegacyComponentReceiver(
        getReactAppInstance(),
        getLegacyNativeApp(),
      ),
      a,
    );
  };

  __Component.prototype.registerModule = function(
    name: string,
    module: object,
  ): void {
    this._reactAppInstance.registerModule(name, module);
  };

  __Component.prototype.getJSModule = function<Module = unknown>(
    name: string,
  ): Module {
    return this._reactAppInstance.getJSModule(name);
  };

  __Component.prototype.addGlobalEventListener = function(
    eventName: string,
    callback: (...args: unknown[]) => void,
    context?: object,
  ): void {
    return this._reactAppInstance.getJSModule('GlobalEventEmitter').addListener(
      eventName,
      callback,
      context,
    );
  };

  __Component.prototype.getElementById = function(id: string) {
    reportRefDeprecationError('getElementById', 'lynx.getElementById');
    return lynx.getElementById(id);
  };

  __Component.prototype.GlobalEventEmitter = reactAppInstance.GlobalEventEmitter;

  __Component.prototype.createSelectorQuery = function() {
    reportRefDeprecationError('createSelectorQuery on component instance', 'lynx.createSelectorQuery');
    return lynx.createSelectorQuery();
  };

  const oldSetState = __Component.prototype[OriginalSetStateKey] ?? __Component.prototype.setState;
  __Component.prototype[OriginalSetStateKey] = oldSetState;
  __Component.prototype.setState = function(state: any, callback: any): void {
    oldSetState.call(this, state, callback);
    // @ts-ignore
    const timingFlag = this[NEXT_STATE][PerfSpecificKey];
    if (timingFlag) {
      globalCommitContext.flushOptions.__lynx_timing_flag = timingFlag;
      markTimingLegacy('updateSetStateTrigger', timingFlag);
      this[NEXT_STATE][PerfSpecificKey] = '';
    }
  };
}

export { installComponentCompat };
