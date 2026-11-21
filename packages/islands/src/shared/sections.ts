// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Return the native section names for an exposed island module.
 * @public
 */
export function islandSections(expose: string): {
  main: string;
  background: string;
  css: string;
} {
  return {
    main: `${expose}/main`,
    background: `${expose}/background`,
    css: `${expose}/css`,
  };
}
