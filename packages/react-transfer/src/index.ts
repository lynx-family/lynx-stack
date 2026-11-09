// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Experimental transfer-view registration for dedicated ReactLynx pages.
 * Each native transfer instance owns a main-thread first frame and a background
 * component tree. Requires the companion native transfer host and snapshot renderer.
 * @packageDocumentation
 */
import type { ComponentType } from 'preact';

import { registry } from './context.js';

/**
 * Registers native-addressable component types for the current transfer page.
 * The first registration opts the current thread into transfer rendering.
 * @example
 * ```tsx
 * import { TransferRegistry } from '@lynx-js/react-transfer';
 * TransferRegistry.registerComponent('ChatBubble', () => ChatBubble);
 * ```
 * @public
 */
export const TransferRegistry: {
  /** Registers a component provider, invoked when the native host creates an instance. */
  registerComponent(
    name: string,
    provider: () => ComponentType<Record<string, unknown>>,
  ): void;
} = registry;
