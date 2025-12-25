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
  #dom: HTMLElement;

  #getInputElement = genDomGetter(() => this.#dom.shadowRoot!, '#input');

  @registerAttributeHandler('placeholder', true)
  _handlerPlaceholder = bindToAttribute(this.#getInputElement, 'placeholder');

  @registerAttributeHandler('placeholder-color', true)
  _handlerPlaceholderColor = bindToStyle(
    this.#getInputElement,
    '--placeholder-color',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-family', true)
  _handlerPlaceholderFontFamily = bindToStyle(
    this.#getInputElement,
    '--placeholder-font-family',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-size', true)
  _handlerPlaceholderFontSize = bindToStyle(
    this.#getInputElement,
    '--placeholder-font-size',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-weight', true)
  _handlerPlaceholderFontWeight = bindToStyle(
    this.#getInputElement,
    '--placeholder-font-weight',
    undefined,
    true,
  );

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }
}
