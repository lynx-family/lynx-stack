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
} from '../../element-reactive/index.js';

type InputType = 'text' | 'number' | 'digit' | 'password' | 'tel' | 'email';
const numberInputFilter = '[^0-9.]|\\.(?=.*\\.)';
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
  #numberInputFilterOverride: string | null | undefined;

  #getInputElement = genDomGetter(() => this.#dom.shadowRoot!, '#input');

  @registerAttributeHandler('confirm-type', true)
  _handlerConfirmType = bindToAttribute(
    this.#getInputElement,
    'enterkeyhint',
    (val) => {
      if (val === null) return 'send';
      return val;
    },
  );

  @registerAttributeHandler('maxlength', true)
  _handlerMaxlength = bindToAttribute(
    this.#getInputElement,
    'maxlength',
    (val) => {
      if (val === null) return '140';
      return val;
    },
  );

  @registerAttributeHandler('readonly', true)
  _handleReadonly = bindToAttribute(
    this.#getInputElement,
    'readonly',
    (value) => (value !== null ? '' : null),
  );

  #setType = bindToAttribute(this.#getInputElement, 'type');
  #setInputmode = bindToAttribute(this.#getInputElement, 'inputmode');

  @registerAttributeHandler('type', true)
  _handleType(value: string | null) {
    const attributeValue = value as InputType;
    const existingInputFilter = this.#dom.getAttribute('input-filter');
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
      if (existingInputFilter !== numberInputFilter) {
        if (this.#numberInputFilterOverride === undefined) {
          this.#numberInputFilterOverride = existingInputFilter;
        }
        this.#dom.setAttribute('input-filter', numberInputFilter);
      }
    } else if (attributeValue === 'email') {
      inputMode = 'email';
    } else if (attributeValue === 'tel') {
      inputMode = 'tel';
    } else {
      inputType = attributeValue;
    }
    if (
      attributeValue !== 'number'
      && this.#numberInputFilterOverride !== undefined
    ) {
      if (this.#numberInputFilterOverride === null) {
        this.#dom.removeAttribute('input-filter');
      } else {
        this.#dom.setAttribute(
          'input-filter',
          this.#numberInputFilterOverride,
        );
      }
      this.#numberInputFilterOverride = undefined;
    }
    this.#setInputmode(inputMode);
    this.#setType(inputType);
  }

  @registerAttributeHandler('ios-spell-check', true)
  @registerAttributeHandler('spell-check', true)
  _handleSpellCheck = bindToAttribute(
    this.#getInputElement,
    'spellcheck',
    (value) => (value === null ? 'false' : 'true'),
  );

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }
}
