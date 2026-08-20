// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable } from '../../../types/index.js';
import { isBuiltinNativeModuleName } from '../../nativeModules/BuiltinNativeModules.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';
import { builtinNativeModuleHandlers } from './builtinNativeModuleHandlers.js';

export type NativeModulesCallHandler = (
  name: string,
  data: Cloneable,
  moduleName: string,
) => unknown;

export function createNativeModulesCallHandler(
  lynxViewInstance: LynxViewInstance,
): NativeModulesCallHandler {
  return (name: string, data: Cloneable, moduleName: string) => {
    if (isBuiltinNativeModuleName(moduleName)) {
      return builtinNativeModuleHandlers[moduleName](name, data);
    }
    return lynxViewInstance.parentDom.onNativeModulesCall?.(
      name,
      data,
      moduleName,
    );
  };
}
