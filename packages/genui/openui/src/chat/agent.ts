// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createLibrary } from '@openuidev/lang-core';

import * as definitions from './definitions.js';

export * from './definitions.js';

/**
 * Create a server-safe schema and prompt library for the supported OpenUI Chat vocabulary.
 * No ReactLynx, native components, or CSS is loaded by this entry.
 * @example
 * ```ts
 * const prompt = createOpenUiChatPromptLibrary().prompt();
 * ```
 */
export function createOpenUiChatPromptLibrary() {
  return createLibrary({
    root: 'Card',
    components: Object.values(definitions),
  });
}
