/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import type { XBlurView } from './XBlurView.js';

export class BlurRadius
  implements InstanceType<AttributeReactiveClass<typeof XBlurView>>
{
  static observedAttributes = ['blur-radius'];
  __dom: XBlurView;
  __getDynamicStyle = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__dynamic-style',
  );

  @registerAttributeHandler('blur-radius', true)
  __handleBlurRadius(newVal: string | null) {
    if (newVal) {
      newVal = `blur(${parseFloat(newVal)}px)`;
      this.__getDynamicStyle().innerHTML =
        `:host { backdrop-filter: ${newVal}; -webkit-backdrop-filter: ${newVal}}`;
    } else {
      this.__getDynamicStyle().innerHTML = '';
    }
  }
  constructor(dom: HTMLElement) {
    this.__dom = dom as XBlurView;
  }
}
