/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { renameEvent } from '../common/renameEvent.js';
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';

export class XTextareaEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['send-composing-input'];
  __dom: HTMLElement;

  __sendComposingInput = false;

  __getTextareaElement = genDomGetter<HTMLInputElement>(
    () => this.__dom.shadowRoot!,
    '__textarea',
  );
  __getFormElement = genDomGetter<HTMLInputElement>(
    () => this.__dom.shadowRoot!,
    '__form',
  );

  @registerEventEnableStatusChangeHandler('input')
  __handleEnableConfirmEvent(status: boolean) {
    const textareaElement = this.__getTextareaElement();
    if (status) {
      textareaElement.addEventListener(
        'input',
        this.__teleportInput as (ev: Event) => void,
        { passive: true },
      );
      textareaElement.addEventListener(
        'compositionend',
        this.__teleportCompositionendInput as (ev: Event) => void,
        { passive: true },
      );
    } else {
      textareaElement.removeEventListener(
        'input',
        this.__teleportInput as (ev: Event) => void,
      );
      textareaElement.removeEventListener(
        'compositionend',
        this.__teleportCompositionendInput as (ev: Event) => void,
      );
    }
  }

  @registerAttributeHandler('send-composing-input', true)
  __handleSendComposingInput(newVal: string | null) {
    this.__sendComposingInput = newVal !== null;
  }

  __teleportEvent = (event: FocusEvent | SubmitEvent) => {
    const eventType = renameEvent[event.type] ?? event.type;
    this.__dom.dispatchEvent(
      new CustomEvent(eventType, {
        ...commonComponentEventSetting,
        detail: {
          value: this.__getTextareaElement().value,
        },
      }),
    );
  };

  __teleportInput = (event: InputEvent) => {
    const input = this.__getTextareaElement();
    const value = input.value;
    const isComposing = event.isComposing;
    if (isComposing && !this.__sendComposingInput) return;
    this.__dom.dispatchEvent(
      new CustomEvent('input', {
        ...commonComponentEventSetting,
        detail: {
          value,
          textLength: value.length,
          cursor: input.selectionStart,
          isComposing,
        },
      }),
    );
  };

  __teleportCompositionendInput = () => {
    const input = this.__getTextareaElement();
    const value = input.value;
    // if __sendComposingInput set true, __teleportInput will send detail
    if (!this.__sendComposingInput) {
      this.__dom.dispatchEvent(
        new CustomEvent('input', {
          ...commonComponentEventSetting,
          detail: {
            value,
            textLength: value.length,
            cursor: input.selectionStart,
          },
        }),
      );
    }
  };

  __blockHtmlEvent = (event: FocusEvent | InputEvent) => {
    if (
      event.target === this.__getTextareaElement()
      && typeof event.detail === 'number'
    ) {
      event.stopImmediatePropagation();
    }
  };

  constructor(dom: HTMLElement) {
    this.__dom = dom;
    const textareaElement = this.__getTextareaElement();
    const formElement = this.__getFormElement();
    textareaElement.addEventListener('blur', this.__teleportEvent, {
      passive: true,
    });
    textareaElement.addEventListener('focus', this.__teleportEvent, {
      passive: true,
    });
    formElement.addEventListener('submit', this.__teleportEvent, {
      passive: true,
    });
    // use form to stop propagation
    formElement.addEventListener('input', this.__blockHtmlEvent as any, {
      passive: true,
    });
  }
}
