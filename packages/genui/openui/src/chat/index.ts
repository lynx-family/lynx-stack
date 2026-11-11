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
 *
 * @remarks
 * This factory registers the entire Chat catalog and includes its component styles.
 * To include only selected components and their styles, import each component from
 * `@lynx-js/genui/openui/chat/<Component>` and assemble the library with
 * `createOpenUiLibrary` from `@lynx-js/genui/openui/explicit`.
 *
 * @example
 * ```tsx
 * const library = createOpenUiChatLibrary();
 * <OpenUiRenderer library={library} response={'root = Card([TextContent("Hello")])'} />;
 * ```
 */
export function createOpenUiChatLibrary(): Library {
  return createLibrary({ root: 'Card', components: Object.values(components) });
}
