// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Maps pre-hydration background handle ids to stable hydrated handle ids.
 */
const hydrationMap: Map<number, number> = /*#__PURE__*/ new Map<number, number>();

/**
 * @internal
 */
export { hydrationMap };
