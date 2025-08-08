// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { setShouldFlush } from './api/element.js';

export interface EomImpl {
  setShouldFlush(value: boolean): void;
}

export function initEomImpl(): EomImpl {
  return {
    setShouldFlush,
  };
}
