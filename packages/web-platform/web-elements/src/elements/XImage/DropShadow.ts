/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindToStyle,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';

export class DropShadow
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['drop-shadow'];
  #dom: HTMLElement;

  #getImg = genDomGetter<HTMLImageElement>(() => this.#dom.shadowRoot!, '#img');

  @registerAttributeHandler('drop-shadow', true)
  _handleBlurRadius = bindToStyle(
    this.#getImg,
    '--drop-shadow',
    undefined,
    true,
  );

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }
}
