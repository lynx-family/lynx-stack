// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as React from 'react';

import * as Lynx from '@lynx-js/types';

export { jsxDEV, Fragment, JSXSource } from 'react/jsx-dev-runtime';
export { jsx, jsxs } from 'react/jsx-runtime';

// Modified from
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/981449c691b9be0fca569c48151fc57606f5ea7a/types/react/jsx-runtime.d.ts#L5
export namespace JSX {
  type ElementType = React.JSX.ElementType;
  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}
  interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
  interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
  type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
  interface IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends Lynx.IntrinsicElements {
    /**
     * Renders `fallback` on the main thread and `children` on the background thread.
     *
     * Resolved at compile time, so the main thread renders only `fallback`. Modules
     * that nothing but `children` reference leave its bundle, including their
     * top-level side effects, while the element definitions the deferred subtree
     * needs stay behind so it can hydrate. The background thread renders `children`,
     * which replace the fallback once it takes over.
     *
     * Only the `fallback` attribute is supported. Spread attributes are a build error.
     * Not supported with `experimental_useElementTemplate`.
     *
     * The fold is the same in development, so what renders there is what renders in
     * production, at the cost of the deferred modules not being refreshable on the
     * main thread.
     *
     * @example
     * ```tsx
     * <view>
     *   <background-only fallback={<Skeleton />}>
     *     <Feed />
     *   </background-only>
     * </view>
     * ```
     *
     * @public
     */
    'background-only': {
      /**
       * Rendered on the main thread first screen in place of `children`.
       * Defaults to rendering nothing.
       */
      fallback?: React.JSX.Element | undefined;
      /**
       * Rendered on the background thread only.
       */
      children?: React.ReactNode | undefined;
    };
  }
}
