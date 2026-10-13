// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * ReactLynx components using the OpenUI Chat positional contracts.
 * @packageDocumentation
 */
import * as components from './components.js';
import { createLibrary } from '../core/library.jsx';
import type { Library } from '../core/library.jsx';

export * from './components.js';

/**
 * Create a library for OpenUI Chat responses rooted at Card.
 * Create once and pass the same instance to OpenUiRenderer across renders.
 * @example
 * ```tsx
 * const library = createOpenUiChatLibrary();
 * <OpenUiRenderer library={library} response={'root = Card([TextContent("Hello")])'} />;
 * ```
 */
export function createOpenUiChatLibrary(): Library {
  return createLibrary({ root: 'Card', components: Object.values(components) });
}
