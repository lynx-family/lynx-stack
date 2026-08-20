// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Tree-shaking marker emitted for a statically defined MainThreadObject type.
 *
 * The React webpack plugin observes live imports of this marker in the
 * background graph and installs the corresponding lifecycle definition in the
 * main-thread graph. The opaque value only prevents a live marker import from
 * being constant-folded before the plugin can inspect the optimized graph.
 *
 * @internal
 */
export const mainThreadObjectDefinition: object = Object.freeze({});
