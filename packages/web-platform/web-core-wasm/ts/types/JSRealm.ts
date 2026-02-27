/*
 * Copyright (C) 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

export type JSRealm = {
  globalWindow: typeof globalThis;
  loadScript: (url: string) => Promise<unknown>;
  loadScriptSync: (url: string) => unknown;
};
