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
  #dom: HTMLElement;
  #inputType: InputType = 'text';

  #getInputElement = genDomGetter(() => this.#dom.shadowRoot!, '#input');

  @registerAttributeHandler('confirm-type', true)
  #handlerConfirmType = bindToAttribute(
    this.#getInputElement,
    'enterkeyhint',
    (val) => {
      if (val === null) return 'send';
      return val;
    },
  );

  @registerAttributeHandler('maxlength', true)
  #handlerMaxlength = bindToAttribute(
    this.#getInputElement,
    'maxlength',
    (val) => {
      if (val === null) return '140';
      return val;
    },
  );

  @registerAttributeHandler('readonly', true)
  #handleReadonly = bindToAttribute(
    this.#getInputElement,
    'readonly',
    (value) => (value !== null ? '' : null),
  );

  #setType = bindToAttribute(this.#getInputElement, 'type');
  #setInputmode = bindToAttribute(this.#getInputElement, 'inputmode');

  @registerAttributeHandler('type', true)
  #handleType(value: string | null) {
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
    /**
     * For number / digit type, if the user is typing "2.", the raw value is expected to remain "2." rather than being altered.
     */
    if (attributeValue === 'digit') {
      inputMode = 'numeric';
    } else if (attributeValue === 'number') {
      inputMode = 'decimal';
    } else if (attributeValue === 'email') {
      inputMode = 'email';
    } else if (attributeValue === 'tel') {
      inputMode = 'tel';
    } else {
      inputType = attributeValue;
    }
    this.#setInputmode(inputMode);
    this.#setType(inputType);
  }

  @registerAttributeHandler('ios-spell-check', true)
  @registerAttributeHandler('spell-check', true)
  #handleSpellCheck = bindToAttribute(
    this.#getInputElement,
    'spellcheck',
    (value) => (value === null ? 'false' : 'true'),
  );

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }
}
