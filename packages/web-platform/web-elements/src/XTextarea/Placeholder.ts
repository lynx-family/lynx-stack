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

  __getTextarea = genDomGetter<HTMLTextAreaElement>(
    () => this.__dom.shadowRoot!,
    '__textarea',
  );

  @registerAttributeHandler('placeholder-color', true)
  __updatePlaceholderColor = bindToStyle(
    this.__getTextarea,
    '--placeholder-color',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-size', true)
  __updatePlaceholderFontSize = bindToStyle(
    this.__getTextarea,
    '--placeholder-font-size',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-weight', true)
  __updatePlaceholderFontWeight = bindToStyle(
    this.__getTextarea,
    '--placeholder-font-weight',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder-font-family', true)
  __updatePlaceholderFontFamily = bindToStyle(
    this.__getTextarea,
    '--placeholder-font-family',
    undefined,
    true,
  );

  @registerAttributeHandler('placeholder', true)
  __handlePlaceholder = bindToAttribute(this.__getTextarea, 'placeholder');

  __dom: HTMLElement;
  constructor(dom: HTMLElement) {
    this.__dom = dom;
  }
}
