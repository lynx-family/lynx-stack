// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Return the native section names for a parcel prefix. */
export function parcelSections(prefix: string): {
  main: string;
  background: string;
  css: string;
} {
  return {
    main: `${prefix}/main`,
    background: `${prefix}/background`,
    css: `${prefix}/css`,
  };
}
