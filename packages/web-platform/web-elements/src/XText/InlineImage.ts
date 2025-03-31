/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  Component,
  genDomGetter,
  html,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';

export class InlineImageAttributes
  implements InstanceType<AttributeReactiveClass<typeof InlineImage>>
{
  static observedAttributes = ['src'];
  __dom: InlineImage;
  constructor(dom: InlineImage) {
    this.__dom = dom;
  }
  __getImage = genDomGetter(() => this.__dom.shadowRoot!, '__img');

  @registerAttributeHandler('src', true)
  __handleSrc(newVal: string | null) {
    if (newVal) this.__getImage().setAttribute('src', newVal);
    else this.__getImage().removeAttribute('src');
  }
}

/**
 * @deprecated you can use `x-image` instead in `x-text`.
 */
@Component<typeof InlineImage>(
  'inline-image',
  [InlineImageAttributes],
  html` <img id="img" part="img" /> `,
)
export class InlineImage extends HTMLElement {}
