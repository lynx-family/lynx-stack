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
    const match = newVal?.trim().match(
      /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z]*)$/i,
    );
    let filter = '';
    if (match && Number.isFinite(Number(match[1])) && Number(match[1]) >= 0) {
      const value = Number(match[1]);
      const unit = match[2]!.toLowerCase() || 'px';
      // Reuse the runtime's reactive viewport and physical-pixel units.
      const radius = unit === 'rpx' || unit === 'ppx'
        ? `calc(${value} * var(--${unit}-unit))`
        : `${value}${unit}`;
      if (CSS.supports('filter', `blur(${radius})`)) {
        filter = `blur(${radius})`;
      }
    }
    this.#getDynamicStyle().textContent = filter
      ? `:host { backdrop-filter: ${filter}; -webkit-backdrop-filter: ${filter}}`
      : '';
  }
  constructor(dom: HTMLElement) {
    this.#dom = dom as XBlurView;
  }
}
