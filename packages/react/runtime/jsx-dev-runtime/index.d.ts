// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { JSX as _JSX } from 'react';

import { IntrinsicElements as _IntrinsicElements } from '@lynx-js/types';

export { jsxDEV, Fragment } from 'react/jsx-dev-runtime';
export { jsx, jsxs } from 'react/jsx-runtime';

export namespace JSX {
  interface IntrinsicElements extends _IntrinsicElements {}

  interface IntrinsicAttributes {}

  type Element = _JSX.Element;
}
