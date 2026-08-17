// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  BUILTIN_NATIVE_MODULE_NAMES,
  LYNX_STORAGE_MODULE_NAME,
  type BuiltinNativeModuleName,
  type BuiltinNativeModulesCall,
} from '../../nativeModules/BuiltinNativeModules.js';
import type { LynxStorageModule } from '../../nativeModules/LynxStorageModule.js';
import { createLynxStorageModule } from './createLynxStorageModule.js';

export interface BuiltinNativeModules {
  [LYNX_STORAGE_MODULE_NAME]: LynxStorageModule;
}

type BuiltinNativeModuleFactories = {
  [Name in BuiltinNativeModuleName]: (
    nativeModulesCall: BuiltinNativeModulesCall,
  ) => BuiltinNativeModules[Name];
};

const builtinNativeModuleFactories = {
  [LYNX_STORAGE_MODULE_NAME]: createLynxStorageModule,
} satisfies BuiltinNativeModuleFactories;

export function createBuiltinNativeModules(
  nativeModulesCall: BuiltinNativeModulesCall,
): BuiltinNativeModules {
  return Object.fromEntries(
    BUILTIN_NATIVE_MODULE_NAMES.map((moduleName) => [
      moduleName,
      builtinNativeModuleFactories[moduleName](nativeModulesCall),
    ]),
  ) as unknown as BuiltinNativeModules;
}
