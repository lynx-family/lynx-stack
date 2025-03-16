// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Component, responsive } from '@lynx-js/web-elements-reactive';
import { defaultBreakpoints } from '@lynx-js/web-constants';

@Component<typeof ResponsiveView>('x-responsive-view', [])
@responsive({
  base: [
    ['display', 'flex'],
    ['flex-direction', 'column'],
    ['padding', '20px'],
  ],
  mediaQueries: [
    {
      query: defaultBreakpoints.mobile,
      styles: [
        ['flex-direction', 'column'],
        ['padding', '10px'],
      ],
    },
    {
      query: defaultBreakpoints.desktop,
      styles: [
        ['flex-direction', 'row'],
        ['padding', '30px'],
      ],
    },
  ],
})
export class ResponsiveView extends HTMLElement {
  constructor() {
    super();
    this.setAttribute('role', 'region');
  }
}
