// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describeWebRuntime } from './helper/describeWebRuntime.js';

describeWebRuntime(
  '__Card__',
  () => import('../runtime/hotModuleReplacement.cjs'),
);
