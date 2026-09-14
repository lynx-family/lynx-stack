// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  LYNX_CLIPBOARD_MODULE_NAME,
} from '../../nativeModules/BuiltinNativeModules.js';
import type { BuiltinNativeModulesCall } from '../../nativeModules/BuiltinNativeModules.js';
import type {
  LynxClipboardModule,
  LynxClipboardModuleCallResult,
} from '../../nativeModules/LynxClipboardModule.js';

function unwrapResult<T>(result: LynxClipboardModuleCallResult): T {
  if (result.ok) {
    return result.value as T;
  }

  const error = new Error(result.error.message);
  error.name = result.error.name;
  throw error;
}

export function createLynxClipboardModule(
  nativeModulesCall: BuiltinNativeModulesCall,
): LynxClipboardModule {
  return {
    async readText(): Promise<string> {
      const result = await nativeModulesCall(
        'readText',
        {},
        LYNX_CLIPBOARD_MODULE_NAME,
      ) as LynxClipboardModuleCallResult;
      return unwrapResult<string>(result);
    },
    async writeText(text: string): Promise<void> {
      const result = await nativeModulesCall(
        'writeText',
        { text },
        LYNX_CLIPBOARD_MODULE_NAME,
      ) as LynxClipboardModuleCallResult;
      unwrapResult(result);
    },
  };
}
