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

export class TextareaBaseAttributes
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'confirm-type',
    'maxlength',
    'readonly',
    'type',
    'ios-spell-check',
    'spell-check',
    'show-soft-input-onfocus',
  ];
  #dom: HTMLElement;

  #getTextareaElement = genDomGetter(() => this.#dom.shadowRoot!, '#textarea');

  @registerAttributeHandler('confirm-type', true)
  _handlerConfirmType = bindToAttribute(
    this.#getTextareaElement,
    'enterkeyhint',
    (val) => {
      if (val === null) return 'send';
      return val;
    },
  );

  @registerAttributeHandler('maxlength', true)
  _handlerMaxlength = bindToAttribute(
    this.#getTextareaElement,
    'maxlength',
    (val) => {
      if (val === null) return '140';
      return val;
    },
  );

  @registerAttributeHandler('readonly', true)
  _handleReadonly = bindToAttribute(
    this.#getTextareaElement,
    'readonly',
    (value) => (value !== null ? '' : null),
  );

  @registerAttributeHandler('ios-spell-check', true)
  _handleSpellCheck = bindToAttribute(
    this.#getTextareaElement,
    'spellcheck',
    (value) => (value === null ? 'false' : 'true'),
  );

  @registerAttributeHandler('show-soft-input-onfocus', true)
  _handleShowSoftInputOnfocus = bindToAttribute(
    this.#getTextareaElement,
    'virtualkeyboardpolicy',
    (value) => (value === null ? 'manual' : 'auto'),
  );

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }
}
