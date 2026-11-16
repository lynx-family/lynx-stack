// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { FetchBundleOptions } from './ExternalBundle.js';

type Assert<T extends true> = T;

export type FetchBundleOptionsAcceptExistingOptionBags = Assert<
  string extends keyof FetchBundleOptions ? true : false
>;
