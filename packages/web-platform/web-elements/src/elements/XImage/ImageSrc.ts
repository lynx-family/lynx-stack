/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindToAttribute,
  bindToStyle,
  genDomGetter,
  registerAttributeHandler,
} from '../../element-reactive/index.js';

export class ImageSrc
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'src',
    'placeholder',
    'blur-radius',
    'crossorigin',
    'referrerpolicy',
  ];
  #dom: HTMLElement;

  #getImg = genDomGetter<HTMLImageElement>(() => this.#dom.shadowRoot!, '#img');

  @registerAttributeHandler('src', true)
  _handleSrc = bindToAttribute(this.#getImg, 'src', (newval) => {
    return newval || this.#dom.getAttribute('placeholder');
  });

  @registerAttributeHandler('placeholder', true)
  _preloadPlaceholder(newVal: string | null) {
    if (newVal) {
      new Image().src = newVal;
    }
  }

  @registerAttributeHandler('blur-radius', true)
  _handleBlurRadius = bindToStyle(
    this.#getImg,
    '--blur-radius',
    undefined,
    true,
  );

  @registerAttributeHandler('crossorigin', true)
  _handleCrossorigin = bindToAttribute(this.#getImg, 'crossorigin');

  @registerAttributeHandler('referrerpolicy', true)
  _handleReferrerpolicy = bindToAttribute(this.#getImg, 'referrerpolicy');

  #onImageError = () => {
    const currentSrc = this.#getImg().src;
    const placeholder = this.#dom.getAttribute('placeholder');
    if (placeholder && currentSrc !== placeholder) {
      this.#getImg().src = placeholder;
    }
  };

  constructor(dom: HTMLElement) {
    this.#dom = dom;
    this.#getImg().addEventListener('error', this.#onImageError);
  }

  connectedCallback() {
    if (
      this.#dom.getAttribute('src') === null
      || this.#dom.getAttribute('src') === ''
    ) {
      this._handleSrc(null);
    }
  }
}
