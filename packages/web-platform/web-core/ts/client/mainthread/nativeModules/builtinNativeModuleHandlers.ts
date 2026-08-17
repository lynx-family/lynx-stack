// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable } from '../../../types/index.js';
import {
  LYNX_STORAGE_MODULE_NAME,
  type BuiltinNativeModuleName,
} from '../../nativeModules/BuiltinNativeModules.js';
import { handleLynxStorageModuleCall } from './handleLynxStorageModuleCall.js';

export type BuiltinNativeModuleHandler = (
  name: string,
  data: Cloneable,
) => unknown;

export const builtinNativeModuleHandlers = {
  [LYNX_STORAGE_MODULE_NAME]: handleLynxStorageModuleCall,
} satisfies Record<BuiltinNativeModuleName, BuiltinNativeModuleHandler>;
