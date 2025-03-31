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

/**
 * shared by x-input and x-input-ng
 */
export class XInputAttribute
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['value', 'disabled'];
  __dom: HTMLElement;

  __getInputElement = genDomGetter<HTMLInputElement>(
    () => this.__dom.shadowRoot!,
    '__input',
  );

  @registerAttributeHandler('value', false)
  // delay value to connectedCallback to wait the maxlength value.
  __handleValue(newValue: string | null) {
    if (newValue) {
      const maxlength = parseFloat(this.__dom.getAttribute('maxlength') ?? '');
      if (!isNaN(maxlength)) newValue = newValue.substring(0, maxlength);
    } else {
      newValue = '';
    }
    const input = this.__getInputElement();
    if (input.value !== newValue) {
      input.value = newValue;
    }
  }

  @registerAttributeHandler('disabled', true)
  __handleDisabled = bindToAttribute(
    this.__getInputElement,
    'disabled',
    (value) => (value !== null ? '' : null),
  );

  constructor(dom: HTMLElement) {
    this.__dom = dom;
  }
}
