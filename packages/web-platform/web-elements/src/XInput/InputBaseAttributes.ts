/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindToAttribute,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';

type InputType = 'text' | 'number' | 'digit' | 'password' | 'tel' | 'email';
/**
 * shared by x-input and x-input-ng
 */
export class InputBaseAttributes
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'confirm-type',
    'maxlength',
    'readonly',
    'type',
    'ios-spell-check',
    'spell-check',
  ];
  __dom: HTMLElement;
  __inputType: InputType = 'text';

  __getInputElement = genDomGetter(() => this.__dom.shadowRoot!, '__input');

  @registerAttributeHandler('confirm-type', true)
  __handlerConfirmType = bindToAttribute(
    this.__getInputElement,
    'enterkeyhint',
    (val) => {
      if (val === null) return 'send';
      return val;
    },
  );

  @registerAttributeHandler('maxlength', true)
  __handlerMaxlength = bindToAttribute(
    this.__getInputElement,
    'maxlength',
    (val) => {
      if (val === null) return '140';
      return val;
    },
  );

  @registerAttributeHandler('readonly', true)
  __handleReadonly = bindToAttribute(
    this.__getInputElement,
    'readonly',
    (value) => (value !== null ? '' : null),
  );

  __setType = bindToAttribute(this.__getInputElement, 'type');
  __setInputmode = bindToAttribute(this.__getInputElement, 'inputmode');

  @registerAttributeHandler('type', true)
  __handleType(value: string | null) {
    const attributeValue = value as InputType;
    // @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode
    let inputMode:
      | 'text'
      | 'decimal'
      | 'numeric'
      | 'tel'
      | 'search'
      | 'email'
      | 'url' = 'text';
    let inputType: 'text' | 'number' | 'password' = 'text';
    if (attributeValue === 'digit') {
      inputMode = 'numeric';
      inputType = 'number';
    } else if (attributeValue === 'number') {
      inputMode = 'decimal';
      inputType = 'number';
    } else if (attributeValue === 'email') {
      inputMode = 'email';
    } else if (attributeValue === 'tel') {
      inputMode = 'tel';
    } else {
      inputType = attributeValue;
    }
    this.__setInputmode(inputMode);
    this.__setType(inputType);
  }

  @registerAttributeHandler('ios-spell-check', true)
  @registerAttributeHandler('spell-check', true)
  __handleSpellCheck = bindToAttribute(
    this.__getInputElement,
    'spellcheck',
    (value) => (value === null ? 'false' : 'true'),
  );

  constructor(dom: HTMLElement) {
    this.__dom = dom;
  }
}
