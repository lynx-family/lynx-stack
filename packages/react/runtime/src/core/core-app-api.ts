// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RootLynx } from '../root-context.js';

/**
 * Typed view over the lynx-core app APIs this runtime relies on
 * (`registerAppEventHandlers`, `getInitDataParams`, ...). The global `lynx`
 * typings lag behind lynx-core; this is the single place that bridges them.
 */
export function coreLynx(pageLynx?: unknown): RootLynx {
  return (pageLynx ?? lynx) as unknown as RootLynx;
}
