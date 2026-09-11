// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  LYNX_STORAGE_MODULE_NAME,
  type BuiltinNativeModulesCall,
} from '../../nativeModules/BuiltinNativeModules.js';
import type {
  LynxStorageModule,
  LynxStorageModuleCallResult,
} from '../../nativeModules/LynxStorageModule.js';

function unwrapResult<T>(result: LynxStorageModuleCallResult): T {
  if (result.ok) {
    return result.value as T;
  }

  const error = new Error(result.error.message);
  error.name = result.error.name;
  throw error;
}

export function createLynxStorageModule(
  nativeModulesCall: BuiltinNativeModulesCall,
): LynxStorageModule {
  return {
    async setItem(key: string, value: string): Promise<void> {
      const result = await nativeModulesCall(
        'setItem',
        { key, value },
        LYNX_STORAGE_MODULE_NAME,
      ) as LynxStorageModuleCallResult;
      unwrapResult(result);
    },
    async getItem(key: string): Promise<string | null> {
      const result = await nativeModulesCall(
        'getItem',
        { key },
        LYNX_STORAGE_MODULE_NAME,
      ) as LynxStorageModuleCallResult;
      return unwrapResult<string | null>(result);
    },
    async removeItem(key: string): Promise<void> {
      const result = await nativeModulesCall(
        'removeItem',
        { key },
        LYNX_STORAGE_MODULE_NAME,
      ) as LynxStorageModuleCallResult;
      unwrapResult(result);
    },
    async getAllKeys(): Promise<string[]> {
      const result = await nativeModulesCall(
        'getAllKeys',
        {},
        LYNX_STORAGE_MODULE_NAME,
      ) as LynxStorageModuleCallResult;
      return unwrapResult<string[]>(result);
    },
  };
}
