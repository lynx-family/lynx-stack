// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getPageLynx } from '../page-lynx.js';

/**
 * Returns the `lynx` of the page this runtime was bound to by `createRoot`,
 * or the module-scope `lynx` without it.
 *
 * @example
 *
 * ```tsx
 * function Popup() {
 *   const lynx = useLynx()
 *   return <view style={{ height: lynx.__globalProps.screenHeight }} />
 * }
 * ```
 *
 * @experimental
 * @alpha
 */
export function useLynx(): typeof lynx {
  return getPageLynx();
}
