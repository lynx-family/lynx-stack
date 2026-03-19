/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindToAttribute,
  genDomGetter,
  registerAttributeHandler,
} from '../../element-reactive/index.js';

export class XWebViewAttribute
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['src', 'html'];
  #dom: HTMLElement;

  #getWebView = genDomGetter<HTMLIFrameElement>(
    () => this.#dom.shadowRoot!,
    '#webview',
  );

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }

  @registerAttributeHandler('src', true)
  _handleSrc = bindToAttribute(this.#getWebView, 'src');

  @registerAttributeHandler('html', true)
  _handleHtml = bindToAttribute(this.#getWebView, 'srcdoc');
}
