// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { startTransition, useTransition } from 'preact/compat';

/* eslint-disable-next-line import/default */
import ReactLynx from '@lynx-js/react';
import { Children } from '../src/compat/children.ts';

export default /*#__PURE__*/ Object.assign({}, ReactLynx, {
  startTransition,
  useTransition,
  Children,
});

export * from '@lynx-js/react';
export { Children, startTransition, useTransition };
