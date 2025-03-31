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

export class XInputEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['send-composing-input'];
  __dom: HTMLElement;

  __sendComposingInput = false;

  __getInputElement = genDomGetter<HTMLInputElement>(
    () => this.__dom.shadowRoot!,
    '__input',
  );
  __getFormElement = genDomGetter<HTMLInputElement>(
    () => this.__dom.shadowRoot!,
    '__form',
  );

  @registerEventEnableStatusChangeHandler('input')
  __handleEnableConfirmEvent(status: boolean) {
    const input = this.__getInputElement();
    if (status) {
      input.addEventListener(
        'input',
        this.__teleportInput as (ev: Event) => void,
        { passive: true },
      );
      input.addEventListener(
        'compositionend',
        this.__teleportCompositionendInput as (ev: Event) => void,
        { passive: true },
      );
    } else {
      input.addEventListener(
        'input',
        this.__teleportInput as (ev: Event) => void,
        { passive: true },
      );
      input.removeEventListener(
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
          value: this.__getInputElement().value,
        },
      }),
    );
  };

  __teleportInput = (event: InputEvent) => {
    const input = this.__getInputElement();
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
    const input = this.__getInputElement();
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

  __blockHtmlEvent = (event: InputEvent) => {
    if (
      event.target === this.__getInputElement()
      && typeof event.detail === 'number'
    ) {
      event.stopImmediatePropagation();
    }
  };

  constructor(dom: HTMLElement) {
    this.__dom = dom;
    const inputElement = this.__getInputElement();
    const formElement = this.__getFormElement();
    inputElement.addEventListener('blur', this.__teleportEvent, {
      passive: true,
    });
    inputElement.addEventListener('focus', this.__teleportEvent, {
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
