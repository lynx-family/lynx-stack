// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable } from '../../types/index.js';

export type LynxStorageModuleMethod =
  | 'setItem'
  | 'getItem'
  | 'removeItem'
  | 'getAllKeys';

export interface LynxStorageKeyData {
  key: string;
}

export interface LynxStorageSetItemData extends LynxStorageKeyData {
  value: string;
}

export interface LynxStorageModule {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

export type LynxStorageModuleCallResult<T = Cloneable> =
  | { ok: true; value: T }
  | {
    ok: false;
    error: {
      name: string;
      message: string;
    };
  };
