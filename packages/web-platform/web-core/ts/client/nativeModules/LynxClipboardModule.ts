// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable } from '../../types/index.js';

export type LynxClipboardModuleMethod = 'readText' | 'writeText';

export interface LynxClipboardWriteTextData {
  text: string;
}

export interface LynxClipboardModule {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export type LynxClipboardModuleCallResult<T = Cloneable> =
  | { ok: true; value: T }
  | {
    ok: false;
    error: {
      name: string;
      message: string;
    };
  };
