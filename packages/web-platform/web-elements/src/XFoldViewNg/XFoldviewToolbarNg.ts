/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { resizeObserver, type XFoldviewNg } from './XFoldviewNg.js';

@Component<typeof XFoldviewToolbarNg>('x-foldview-toolbar-ng', [
  CommonEventsAndMethods,
])
export class XFoldviewToolbarNg extends HTMLElement {
  connectedCallback() {
    (this.parentElement as XFoldviewNg | null)?.[resizeObserver]?.observe(this);
  }
  dispose() {
    (this.parentElement as XFoldviewNg | null)?.[resizeObserver]?.unobserve(
      this,
    );
  }
}
