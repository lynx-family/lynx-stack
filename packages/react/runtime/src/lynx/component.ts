// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable */

import { Component } from 'preact';

import { PerfSpecificKey, markTimingLegacy } from './performance.js';
import { globalFlushOptions } from '../lifecycle/patch/commit.js';
import { NEXT_STATE } from '../renderToOpcodes/constants.js';

if (__JS__) {
  function reportRefDeprecationError(fnName: string, newFnName: string) {
    if (!__DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__) {
      lynx.reportError(
        new Error(
          `${fnName} is deprecated and has different behavior in ReactLynx 3.0, please use ref or ${newFnName} instead.`,
        ),
      );
    }
  }

  const __Component = Component as any;

  __Component.prototype._reactAppInstance = lynxCoreInject.tt;

  __Component.prototype.getNodeRef = function(a: string, b?: boolean) {
    reportRefDeprecationError('getNodeRef', 'lynx.createSelectorQuery');

    // @ts-expect-error hack lynx-kernel
    return lynxCoreInject.tt._reactLynx.ReactComponent.prototype.getNodeRef
      .call(
        {
          _type: '',
          // @ts-expect-error hack lynx-kernel
          _nativeApp: lynxCoreInject.tt._nativeApp,
          // @ts-expect-error hack lynx-kernel
          _uiModule: lynxCoreInject.tt._nativeApp.nativeModuleProxy.LynxUIMethodModule,
          _reactAppInstance: lynxCoreInject.tt,
        },
        a,
        b,
      );
  };

  __Component.prototype.getNodeRefFromRoot = function(a: string) {
    reportRefDeprecationError('getNodeRefFromRoot', 'lynx.createSelectorQuery');

    // @ts-expect-error hack lynx-kernel
    return lynxCoreInject.tt._reactLynx.ReactComponent.prototype
      .getNodeRefFromRoot.call(
        {
          _type: '',
          // @ts-expect-error hack lynx-kernel
          _nativeApp: lynxCoreInject.tt._nativeApp,
          // @ts-expect-error hack lynx-kernel
          _uiModule: lynxCoreInject.tt._nativeApp.nativeModuleProxy.LynxUIMethodModule,
          _reactAppInstance: lynxCoreInject.tt,
        },
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

  __Component.prototype.GlobalEventEmitter = lynxCoreInject.tt.GlobalEventEmitter;

  __Component.prototype.createSelectorQuery = function() {
    reportRefDeprecationError('createSelectorQuery on component instance', 'lynx.createSelectorQuery');
    return lynx.createSelectorQuery();
  };

  const oldSetState = __Component.prototype.setState;
  __Component.prototype.setState = function(state: any, callback: any): void {
    oldSetState.call(this, state, callback);
    // @ts-ignore
    const timingFlag = this[NEXT_STATE][PerfSpecificKey];
    if (timingFlag) {
      globalFlushOptions.__lynx_timing_flag = timingFlag;
      markTimingLegacy('updateSetStateTrigger', timingFlag);
      this[NEXT_STATE][PerfSpecificKey] = '';
    }
  };
}
