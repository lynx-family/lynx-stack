// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { startTransition, useTransition } from 'preact/compat';

import * as ReactLynx from '@lynx-js/react';

export default {
  ...ReactLynx,
  startTransition,
  useTransition,
};

export * from '@lynx-js/react';
export { startTransition, useTransition };
