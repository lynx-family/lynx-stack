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
import { XTextarea } from './XTextarea.js';

export class Placeholder
  implements InstanceType<AttributeReactiveClass<typeof XTextarea>>
{
  static observedAttributes = [
    'placeholder',
    'placeholder-color',
    'placeholder-font-size',
    'placeholder-font-weight',
    'placeholder-font-family',
  ] as const;

  #getTextarea = genDomGetter<HTMLTextAreaElement>(
    () => this.#dom.shadowRoot!,
    '#textarea',
  );

  @registerAttributeHandler('placeholder-color', true)
  _updatePlaceholderColor = bindToStyle(
    this.#getTextarea,
    '--placeholder-color',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-size', true)
  _updatePlaceholderFontSize = bindToStyle(
    this.#getTextarea,
    '--placeholder-font-size',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-weight', true)
  _updatePlaceholderFontWeight = bindToStyle(
    this.#getTextarea,
    '--placeholder-font-weight',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-family', true)
  _updatePlaceholderFontFamily = bindToStyle(
    this.#getTextarea,
    '--placeholder-font-family',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder', true)
  _handlePlaceholder = bindToAttribute(this.#getTextarea, 'placeholder');

  #dom: HTMLElement;
  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }
}
