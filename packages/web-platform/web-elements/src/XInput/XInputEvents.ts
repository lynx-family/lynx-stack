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
  #dom: HTMLElement;

  #sendComposingInput = false;

  #getInputElement = genDomGetter<HTMLInputElement>(
    () => this.#dom.shadowRoot!,
    '#input',
  );
  #getFormElement = genDomGetter<HTMLInputElement>(
    () => this.#dom.shadowRoot!,
    '#form',
  );

  @registerEventEnableStatusChangeHandler('input')
  #handleEnableConfirmEvent(status: boolean) {
    const input = this.#getInputElement();
    if (status) {
      input.addEventListener(
        'input',
        this.#teleportInput as (ev: Event) => void,
        { passive: true },
      );
      input.addEventListener(
        'compositionend',
        this.#teleportCompositionendInput as (ev: Event) => void,
        { passive: true },
      );
    } else {
      input.removeEventListener(
        'input',
        this.#teleportInput as (ev: Event) => void,
      );
      input.removeEventListener(
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
          value: this.#getInputElement().value,
        },
      }),
    );
  };

  #teleportInput = (event: InputEvent) => {
    const input = this.#getInputElement();
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
    const input = this.#getInputElement();
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

  #blockHtmlEvent = (event: InputEvent) => {
    if (
      event.target === this.#getInputElement()
      && typeof event.detail === 'number'
    ) {
      event.stopImmediatePropagation();
    }
  };

  constructor(dom: HTMLElement) {
    this.#dom = dom;
    const inputElement = this.#getInputElement();
    const formElement = this.#getFormElement();
    inputElement.addEventListener('blur', this.#teleportEvent, {
      passive: true,
    });
    inputElement.addEventListener('focus', this.#teleportEvent, {
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
