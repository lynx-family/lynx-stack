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
  registerStyleChangeHandler,
} from '../../element-reactive/index.js';

import type { ScrollView } from './ScrollView.js';

export class FadeEdgeLengthAttribute
  implements InstanceType<AttributeReactiveClass<typeof ScrollView>>
{
  #dom: ScrollView;
  #getTopFadeMask = genDomGetter(() => this.#dom.shadowRoot!, '#top-fade-mask');
  #getBotFadeMask = genDomGetter(() => this.#dom.shadowRoot!, '#bot-fade-mask');
  static observedAttributes = ['fading-edge-length'];
  static observedCSSProperties = ['background', 'background-color'];

  constructor(dom: ScrollView) {
    this.#dom = dom;
  }

  @registerAttributeHandler('fading-edge-length', true)
  _handleFadingEdgeLength = bindToStyle(
    () => this.#dom,
    '--scroll-view-fading-edge-length',
    (v) => `${parseFloat(v)}px`,
  );

  @registerStyleChangeHandler('background')
  @registerStyleChangeHandler('background-color')
  _backgroundColorToVariable(backGroundColor: string | null) {
    this.#getTopFadeMask().style.setProperty(
      '--scroll-view-bg-color',
      backGroundColor,
    );
    this.#getBotFadeMask().style.setProperty(
      '--scroll-view-bg-color',
      backGroundColor,
    );
  }

  connectedCallback?(): void {}
  dispose(): void {}
}
