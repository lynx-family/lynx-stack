// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import * as defaultTransform from '@lynx-js/react/transform';

/**
 * The ReactLynx transform a loader runs.
 *
 * The default one is imported statically, so a bundler that packs these
 * loaders (for a build in the browser through `@rspack/browser`) includes it.
 * A custom `transformPath` is still loaded with `require` when it is set.
 */
export function loadTransform(
  transformPath: string | undefined,
): typeof defaultTransform {
  if (transformPath === undefined) {
    return defaultTransform;
  }
  return createRequire(import.meta.url)(
    transformPath,
  ) as typeof defaultTransform;
}
