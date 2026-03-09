// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
declare module '*.vue' {
  import type { Component } from '@lynx-js/vue-runtime';

  const component: Component;
  export default component;
}

declare module '*.png' {
  const src: string;
  export default src;
}
