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

/**
 * shared by x-input and x-input-ng
 */
export class XInputAttribute
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['value', 'disabled', 'autocomplete'];
  #dom: HTMLElement;

  #getInputElement = genDomGetter<HTMLInputElement>(
    () => this.#dom.shadowRoot!,
    '#input',
  );

  @registerAttributeHandler('value', false)
  // delay value to connectedCallback to wait the maxlength value.
  _handleValue(newValue: string | null) {
    if (newValue) {
      const maxlength = parseFloat(this.#dom.getAttribute('maxlength') ?? '');
      if (!isNaN(maxlength)) newValue = newValue.substring(0, maxlength);
    } else {
      newValue = '';
    }
    const input = this.#getInputElement();
    if (input.value !== newValue) {
      input.value = newValue;
    }
  }

  @registerAttributeHandler('disabled', true)
  _handleDisabled = bindToAttribute(
    this.#getInputElement,
    'disabled',
    (value) => (value !== null ? '' : null),
  );

  @registerAttributeHandler('autocomplete', true)
  _handleAutocomplete = bindToAttribute(
    this.#getInputElement,
    'autocomplete',
  );

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }
}
