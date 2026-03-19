/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
  registerAttributeHandler,
} from '../../element-reactive/index.js';
import type { XBlurView } from './XBlurView.js';

export class BlurRadius
  implements InstanceType<AttributeReactiveClass<typeof XBlurView>>
{
  static observedAttributes = ['blur-radius'];
  #dom: XBlurView;
  #getDynamicStyle = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#dynamic-style',
  );

  @registerAttributeHandler('blur-radius', true)
  _handleBlurRadius(newVal: string | null) {
    if (newVal) {
      newVal = `blur(${parseFloat(newVal)}px)`;
      this.#getDynamicStyle().innerHTML =
        `:host { backdrop-filter: ${newVal}; -webkit-backdrop-filter: ${newVal}}`;
    } else {
      this.#getDynamicStyle().innerHTML = '';
    }
  }
  constructor(dom: HTMLElement) {
    this.#dom = dom as XBlurView;
  }
}
