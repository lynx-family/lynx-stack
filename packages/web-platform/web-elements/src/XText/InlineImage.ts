/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  Component,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { templateInlineImage } from '@lynx-js/web-elements-template';

export class InlineImageAttributes
  implements InstanceType<AttributeReactiveClass<typeof InlineImage>>
{
  static observedAttributes = ['src'];
  #dom: InlineImage;
  constructor(dom: InlineImage) {
    this.#dom = dom;
  }
  #getImage = genDomGetter(() => this.#dom.shadowRoot!, '#img');

  @registerAttributeHandler('src', true)
  #handleSrc(newVal: string | null) {
    if (newVal) this.#getImage().setAttribute('src', newVal);
    else this.#getImage().removeAttribute('src');
  }
}

/**
 * @deprecated you can use `x-image` instead in `x-text`.
 */
@Component<typeof InlineImage>(
  'inline-image',
  [InlineImageAttributes],
  templateInlineImage({}),
)
export class InlineImage extends HTMLElement {}
