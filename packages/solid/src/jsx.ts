// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SolidLynxNode } from './renderer.js';

// biome-ignore lint/style/noNamespace: TypeScript JSX runtimes require a JSX namespace.
export namespace JSX {
  export type Element = SolidLynxNode;

  export interface ElementChildrenAttribute {
    children: unknown;
  }

  export interface IntrinsicAttributes {
    children?: unknown;
  }

  export type IntrinsicElements = Record<
    string,
    {
      children?: unknown;
      class?: string | undefined;
      className?: string | undefined;
      style?:
        | string
        | Record<string, string | number | undefined>
        | undefined;
      bindtap?: ((event: unknown) => void) | undefined;
      catchtap?: ((event: unknown) => void) | undefined;
      [attributeName: string]: unknown;
    }
  >;
}
