// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** @packageDocumentation Load and mount embedded UI in a native Lynx host. */

export { prepareParcelBackground } from './background.js';
export { installParcelBackground } from './bridge.js';
export { mountParcel } from './mount.js';
export type { MountParcelOptions, Parcel } from './mount.js';
export { loadParcel } from './main.js';
export type {
  ParcelExports,
  ParcelLifecycle,
  ParcelSource,
  DispatchParcelBackground,
  LoadedParcel,
} from './types.js';
