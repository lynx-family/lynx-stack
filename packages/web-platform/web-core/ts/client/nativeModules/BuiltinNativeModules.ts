// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable } from '../../types/index.js';

export const LYNX_CLIPBOARD_MODULE_NAME = 'LynxClipboardModule';
export const LYNX_STORAGE_MODULE_NAME = 'LynxStorageModule';

export const BUILTIN_NATIVE_MODULE_NAMES = [
  LYNX_CLIPBOARD_MODULE_NAME,
  LYNX_STORAGE_MODULE_NAME,
] as const;

export type BuiltinNativeModuleName =
  typeof BUILTIN_NATIVE_MODULE_NAMES[number];

export type BuiltinNativeModulesCall = (
  name: string,
  data: Cloneable,
  moduleName: BuiltinNativeModuleName,
) => Promise<unknown>;

export function isBuiltinNativeModuleName(
  name: string,
): name is BuiltinNativeModuleName {
  return BUILTIN_NATIVE_MODULE_NAMES.includes(
    name as BuiltinNativeModuleName,
  );
}
