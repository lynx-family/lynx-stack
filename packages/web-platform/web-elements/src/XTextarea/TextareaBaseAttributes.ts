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
  __dom: HTMLElement;

  __getTextareaElement = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__textarea',
  );

  @registerAttributeHandler('confirm-type', true)
  __handlerConfirmType = bindToAttribute(
    this.__getTextareaElement,
    'enterkeyhint',
    (val) => {
      if (val === null) return 'send';
      return val;
    },
  );

  @registerAttributeHandler('maxlength', true)
  __handlerMaxlength = bindToAttribute(
    this.__getTextareaElement,
    'maxlength',
    (val) => {
      if (val === null) return '140';
      return val;
    },
  );

  @registerAttributeHandler('readonly', true)
  __handleReadonly = bindToAttribute(
    this.__getTextareaElement,
    'readonly',
    (value) => (value !== null ? '' : null),
  );

  @registerAttributeHandler('ios-spell-check', true)
  __handleSpellCheck = bindToAttribute(
    this.__getTextareaElement,
    'spellcheck',
    (value) => (value === null ? 'false' : 'true'),
  );

  @registerAttributeHandler('show-soft-input-onfocus', true)
  __handleShowSoftInputOnfocus = bindToAttribute(
    this.__getTextareaElement,
    'virtualkeyboardpolicy',
    (value) => (value === null ? 'manual' : 'auto'),
  );

  constructor(dom: HTMLElement) {
    this.__dom = dom;
  }
}
