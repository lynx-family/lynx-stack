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
} from '@lynx-js/web-elements-reactive';

export class ImageSrc
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['src', 'placeholder', 'blur-radius'];
  __dom: HTMLElement;

  __getImg = genDomGetter<HTMLImageElement>(
    () => this.__dom.shadowRoot!,
    '__img',
  );

  @registerAttributeHandler('src', true)
  __handleSrc = bindToAttribute(this.__getImg, 'src', (newval) => {
    return newval || this.__dom.getAttribute('placeholder');
  });

  @registerAttributeHandler('placeholder', true)
  __preloadPlaceholder(newVal: string | null) {
    if (newVal) {
      new Image().src = newVal;
    }
  }

  @registerAttributeHandler('blur-radius', true)
  __handleBlurRadius = bindToStyle(
    this.__getImg,
    '--blur-radius',
    undefined,
    true,
  );

  __onImageError = () => {
    const currentSrc = this.__getImg().src;
    const placeholder = this.__dom.getAttribute('placeholder');
    if (placeholder && currentSrc !== placeholder) {
      this.__getImg().src = placeholder;
    }
  };

  constructor(dom: HTMLElement) {
    this.__dom = dom;
    this.__getImg().addEventListener('error', this.__onImageError);
  }

  connectedCallback() {
    if (
      this.__dom.getAttribute('src') === null
      || this.__dom.getAttribute('src') === ''
    ) {
      this.__handleSrc(null);
    }
  }
}
