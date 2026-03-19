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
  bindToStyle,
} from '../../element-reactive/index.js';

export class XTextareaAttributes
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'confirm-enter',
    'disabled',
    'max-height',
    'min-height',
    'value',
  ];
  #dom: HTMLElement;

  #getTextareaElement = genDomGetter<HTMLTextAreaElement>(
    () => this.#dom.shadowRoot!,
    '#textarea',
  );
  #getFormElement = genDomGetter(() => this.#dom.shadowRoot!, '#form');

  #confirmEnter = false;
  @registerAttributeHandler('confirm-enter', true)
  _handleConfirmEnter(newVal: string | null) {
    this.#confirmEnter = newVal !== null;
  }

  @registerAttributeHandler('disabled', true)
  _handleDisabled = bindToAttribute(
    this.#getTextareaElement,
    'disabled',
    (value) => (value !== null ? '' : null),
  );

  @registerAttributeHandler('max-height', true)
  _handleMaxHeight = bindToStyle(this.#getTextareaElement, 'max-height');

  @registerAttributeHandler('min-height', true)
  _handleMinHeight = bindToStyle(this.#getTextareaElement, 'min-height');

  @registerAttributeHandler('value', false)
  // delay value to connectedCallback to wait the maxlength value.
  _handleValue(newValue: string | null) {
    if (newValue) {
      const maxlength = parseFloat(this.#dom.getAttribute('maxlength') ?? '');
      if (!isNaN(maxlength)) newValue = newValue.substring(0, maxlength);
    } else {
      newValue = '';
    }
    const textarea = this.#getTextareaElement();
    if (textarea.value !== newValue) {
      textarea.value = newValue;
    }
  }

  #handleKeyEvent = (event: KeyboardEvent) => {
    if (this.#confirmEnter && event.key === 'Enter') {
      this.#getFormElement().dispatchEvent(new SubmitEvent('submit'));
    }
  };

  constructor(dom: HTMLElement) {
    this.#dom = dom;
    this.#getTextareaElement().addEventListener('keyup', this.#handleKeyEvent);
  }
}
