/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '@lynx-js/web-elements-reactive';

@Component<typeof InlineTruncation>('inline-truncation', [])
export class InlineTruncation extends HTMLElement {
  static XEnableCustomTruncation = 'x-text-custom-overflow';
  connectedCallback() {
    if (!CSS.supports('selector(:has(inline-truncation))')) {
      if (
        this.parentElement?.tagName === 'X-TEXT'
        && !this.matches('inline-truncation ~ inline-truncation')
      ) {
        this.parentElement.setAttribute(
          InlineTruncation.XEnableCustomTruncation,
          '',
        );
      }
    }
    this.setAttribute('slot', 'inline-truncation');
  }
  disconnectedCallback() {
    this.parentElement?.removeAttribute(
      InlineTruncation.XEnableCustomTruncation,
    );
  }
}
