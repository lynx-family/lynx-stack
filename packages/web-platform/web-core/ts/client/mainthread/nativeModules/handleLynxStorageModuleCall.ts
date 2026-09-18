// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable } from '../../../types/index.js';
import type {
  LynxStorageKeyData,
  LynxStorageModuleCallResult,
  LynxStorageSetItemData,
} from '../../nativeModules/LynxStorageModule.js';

function toCloneableError(error: unknown): {
  name: string;
  message: string;
} {
  if (typeof error === 'object' && error !== null) {
    const errorLike = error as { name?: unknown; message?: unknown };
    if (
      typeof errorLike.name === 'string'
      && typeof errorLike.message === 'string'
    ) {
      return { name: errorLike.name, message: errorLike.message };
    }
  }
  return { name: 'Error', message: String(error) };
}

export function handleLynxStorageModuleCall(
  name: string,
  data: Cloneable,
  storage?: Storage,
): LynxStorageModuleCallResult {
  try {
    const targetStorage = storage ?? globalThis.localStorage;
    switch (name) {
      case 'setItem': {
        const { key, value } = data as unknown as LynxStorageSetItemData;
        targetStorage.setItem(key, value);
        return { ok: true, value: undefined };
      }
      case 'getItem': {
        const { key } = data as unknown as LynxStorageKeyData;
        return { ok: true, value: targetStorage.getItem(key) };
      }
      case 'removeItem': {
        const { key } = data as unknown as LynxStorageKeyData;
        targetStorage.removeItem(key);
        return { ok: true, value: undefined };
      }
      case 'getAllKeys': {
        const keys: string[] = [];
        for (let index = 0; index < targetStorage.length; index++) {
          const key = targetStorage.key(index);
          if (key !== null) {
            keys.push(key);
          }
        }
        return { ok: true, value: keys };
      }
      default:
        throw new TypeError(
          `Unsupported LynxStorageModule method: ${name}`,
        );
    }
  } catch (error) {
    return { ok: false, error: toCloneableError(error) };
  }
}
