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
  #dom: HTMLElement;

  #sendComposingInput = false;

  #getTextareaElement = genDomGetter<HTMLInputElement>(
    () => this.#dom.shadowRoot!,
    '#textarea',
  );
  #getFormElement = genDomGetter<HTMLInputElement>(
    () => this.#dom.shadowRoot!,
    '#form',
  );

  @registerEventEnableStatusChangeHandler('input')
  #handleEnableConfirmEvent(status: boolean) {
    const textareaElement = this.#getTextareaElement();
    if (status) {
      textareaElement.addEventListener(
        'input',
        this.#teleportInput as (ev: Event) => void,
        { passive: true },
      );
      textareaElement.addEventListener(
        'compositionend',
        this.#teleportCompositionendInput as (ev: Event) => void,
        { passive: true },
      );
    } else {
      textareaElement.removeEventListener(
        'input',
        this.#teleportInput as (ev: Event) => void,
      );
      textareaElement.removeEventListener(
        'compositionend',
        this.#teleportCompositionendInput as (ev: Event) => void,
      );
    }
  }

  @registerAttributeHandler('send-composing-input', true)
  #handleSendComposingInput(newVal: string | null) {
    this.#sendComposingInput = newVal !== null;
  }

  #teleportEvent = (event: FocusEvent | SubmitEvent) => {
    const eventType = renameEvent[event.type] ?? event.type;
    this.#dom.dispatchEvent(
      new CustomEvent(eventType, {
        ...commonComponentEventSetting,
        detail: {
          value: this.#getTextareaElement().value,
        },
      }),
    );
  };

  #teleportInput = (event: InputEvent) => {
    const input = this.#getTextareaElement();
    const value = input.value;
    const isComposing = event.isComposing;
    if (isComposing && !this.#sendComposingInput) return;
    this.#dom.dispatchEvent(
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

  #teleportCompositionendInput = () => {
    const input = this.#getTextareaElement();
    const value = input.value;
    // if #sendComposingInput set true, #teleportInput will send detail
    if (!this.#sendComposingInput) {
      this.#dom.dispatchEvent(
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

  #blockHtmlEvent = (event: FocusEvent | InputEvent) => {
    if (
      event.target === this.#getTextareaElement()
      && typeof event.detail === 'number'
    ) {
      event.stopImmediatePropagation();
    }
  };

  constructor(dom: HTMLElement) {
    this.#dom = dom;
    const textareaElement = this.#getTextareaElement();
    const formElement = this.#getFormElement();
    textareaElement.addEventListener('blur', this.#teleportEvent, {
      passive: true,
    });
    textareaElement.addEventListener('focus', this.#teleportEvent, {
      passive: true,
    });
    formElement.addEventListener('submit', this.#teleportEvent, {
      passive: true,
    });
    // use form to stop propagation
    formElement.addEventListener('input', this.#blockHtmlEvent as any, {
      passive: true,
    });
  }
}
