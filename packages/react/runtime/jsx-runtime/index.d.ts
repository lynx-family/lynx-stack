// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as React from 'react';

import * as Lynx from '@lynx-js/types';

export { jsx, jsxs, Fragment } from 'react/jsx-runtime';

// Modified from
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/981449c691b9be0fca569c48151fc57606f5ea7a/types/react/jsx-runtime.d.ts#L5
export namespace JSX {
  type ElementType = React.JSX.ElementType;
  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}
  interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
  interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
  type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
  // We are not extending the `React.JSX.IntrinsicAttributes` because it will be populated
  // by `Lynx.IntrinsicAttributes`.
  interface IntrinsicAttributes {
    key?: React.Key | null | undefined;
  }
  interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends Lynx.IntrinsicElements {}
}
