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
} from '@lynx-js/web-elements-reactive';
import type { ScrollView } from './ScrollView.js';

export class FadeEdgeLengthAttribute
  implements InstanceType<AttributeReactiveClass<typeof ScrollView>>
{
  __dom: ScrollView;
  __getTopFadeMask = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__top-fade-mask',
  );
  __getBotFadeMask = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__bot-fade-mask',
  );
  static observedAttributes = ['fading-edge-length'];
  static observedCSSProperties = ['background', 'background-color'];

  constructor(dom: ScrollView) {
    this.__dom = dom;
  }

  @registerAttributeHandler('fading-edge-length', true)
  __handleFadingEdgeLength = bindToStyle(
    () => this.__dom,
    '--scroll-view-fading-edge-length',
    (v) => `${parseFloat(v)}px`,
  );

  @registerStyleChangeHandler('background')
  @registerStyleChangeHandler('background-color')
  __backgroundColorToVariable(backGroundColor: string | null) {
    this.__getTopFadeMask().style.setProperty(
      '--scroll-view-bg-color',
      backGroundColor,
    );
    this.__getBotFadeMask().style.setProperty(
      '--scroll-view-bg-color',
      backGroundColor,
    );
  }

  connectedCallback?(): void {}
  dispose(): void {}
}
