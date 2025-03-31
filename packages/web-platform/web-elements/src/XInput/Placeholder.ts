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

export class Placeholder
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'placeholder',
    'placeholder-color',
    'placeholder-font-family',
    'placeholder-font-size',
    'placeholder-font-weight',
  ];
  __dom: HTMLElement;

  __getInputElement = genDomGetter(() => this.__dom.shadowRoot!, '__input');

  @registerAttributeHandler('placeholder', true)
  __handlerPlaceholder = bindToAttribute(this.__getInputElement, 'placeholder');

  @registerAttributeHandler('placeholder-color', true)
  __handlerPlaceholderColor = bindToStyle(
    this.__getInputElement,
    '--placeholder-color',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-family', true)
  __handlerPlaceholderFontFamily = bindToStyle(
    this.__getInputElement,
    '--placeholder-font-family',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-size', true)
  __handlerPlaceholderFontSize = bindToStyle(
    this.__getInputElement,
    '--placeholder-font-size',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-weight', true)
  __handlerPlaceholderFontWeight = bindToStyle(
    this.__getInputElement,
    '--placeholder-font-weight',
    undefined,
    true,
  );

  constructor(dom: HTMLElement) {
    this.__dom = dom;
  }
}
