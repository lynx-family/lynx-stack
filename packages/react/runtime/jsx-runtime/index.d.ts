// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { IntrinsicElements as _IntrinsicElements } from '@lynx-js/types';
import { JSX as _JSX } from 'react';

export namespace JSX {
  interface IntrinsicElements extends _IntrinsicElements {}

  interface IntrinsicAttributes {}

  type Element = _JSX.Element;
}
