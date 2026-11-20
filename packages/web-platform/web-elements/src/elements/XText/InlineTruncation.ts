/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '../../element-reactive/index.js';

@Component<typeof InlineTruncation>('inline-truncation', [])
export class InlineTruncation extends HTMLElement {
  static XEnableCustomTruncation = 'x-text-custom-overflow';
  #customOverflowText?: Element;
  connectedCallback() {
    if (!CSS.supports('selector(:has(>inline-truncation))')) {
      // A conditionally rendered inline-truncation is mounted inside a transparent lynx-wrapper.
      const text = this.parentElement?.tagName === 'LYNX-WRAPPER'
        ? this.parentElement.parentElement
        : this.parentElement;
      if (
        text?.tagName === 'X-TEXT'
        && !this.matches('inline-truncation ~ inline-truncation')
      ) {
        text.setAttribute(InlineTruncation.XEnableCustomTruncation, '');
        this.#customOverflowText = text;
      }
    }
    this.setAttribute('slot', 'inline-truncation');
  }
  disconnectedCallback() {
    (this.#customOverflowText ?? this.parentElement)?.removeAttribute(
      InlineTruncation.XEnableCustomTruncation,
    );
    this.#customOverflowText = undefined;
  }
}
