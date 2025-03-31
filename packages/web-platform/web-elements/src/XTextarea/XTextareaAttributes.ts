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
} from '@lynx-js/web-elements-reactive';

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
  __dom: HTMLElement;

  __getTextareaElement = genDomGetter<HTMLTextAreaElement>(
    () => this.__dom.shadowRoot!,
    '__textarea',
  );
  __getFormElement = genDomGetter(() => this.__dom.shadowRoot!, '__form');

  __confirmEnter = false;
  @registerAttributeHandler('confirm-enter', true)
  __handleConfirmEnter(newVal: string | null) {
    this.__confirmEnter = newVal !== null;
  }

  @registerAttributeHandler('disabled', true)
  __handleDisabled = bindToAttribute(
    this.__getTextareaElement,
    'disabled',
    (value) => (value !== null ? '' : null),
  );

  @registerAttributeHandler('max-height', true)
  __handleMaxHeight = bindToStyle(this.__getTextareaElement, 'max-height');

  @registerAttributeHandler('min-height', true)
  __handleMinHeight = bindToStyle(this.__getTextareaElement, 'min-height');

  @registerAttributeHandler('value', false)
  // delay value to connectedCallback to wait the maxlength value.
  __handleValue(newValue: string | null) {
    if (newValue) {
      const maxlength = parseFloat(this.__dom.getAttribute('maxlength') ?? '');
      if (!isNaN(maxlength)) newValue = newValue.substring(0, maxlength);
    } else {
      newValue = '';
    }
    const textarea = this.__getTextareaElement();
    if (textarea.value !== newValue) {
      textarea.value = newValue;
    }
  }

  __handleKeyEvent = (event: KeyboardEvent) => {
    if (this.__confirmEnter && event.key === 'Enter') {
      this.__getFormElement().dispatchEvent(new SubmitEvent('submit'));
    }
  };

  constructor(dom: HTMLElement) {
    this.__dom = dom;
    this.__getTextareaElement().addEventListener(
      'keyup',
      this.__handleKeyEvent,
    );
  }
}
