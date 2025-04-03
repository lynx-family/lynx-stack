/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  boostedQueueMicrotask,
  genDomGetter,
  registerAttributeHandler,
  registerEventEnableStatusChangeHandler,
} from '@lynx-js/web-elements-reactive';

// Import the sanitizeInput function from our new security module
import { sanitizeInput } from '@lynx-js/web-security';

import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { renameEvent } from '../common/renameEvent.js';

export class XInputEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['send-composing-input'];
  #dom: HTMLElement;
  #getInputElement = genDomGetter<HTMLInputElement>(
    () => this.#dom.shadowRoot!,
    '#input',
  );
  #getFormElement = genDomGetter<HTMLFormElement>(
    () => this.#dom.shadowRoot!,
    '#form',
  );
  #enableComposingInput = false;
  #composingInputInterval = 500;
  #isComposingInput = false;
  #scheduledComposingTimer = 0;
  #prevBlockDomEnv: { value: string; selectionStart: number | null } = {
    value: '',
    selectionStart: 0,
  };

  @registerAttributeHandler('send-composing-input', true)
  #handleEnableSendComposingInput(newValue: string | null) {
    this.#enableComposingInput = newValue !== null;
    if (newValue !== null) {
      this.#composingInputInterval = Number.parseInt(newValue) || 500;
    }
  }

  @registerEventEnableStatusChangeHandler('input')
  #handleInputEventEnable(enabled: boolean) {
    const formElement = this.#getFormElement();
    if (enabled) {
      formElement.addEventListener('input', this.#blockHtmlEvent as any, {
        passive: true,
      });
    } else {
      formElement.removeEventListener('input', this.#blockHtmlEvent as any);
    }
  }

  #blockHtmlEvent = (e: InputEvent) => {
    e.stopPropagation();
    this.#prevBlockDomEnv.value = this.#getInputElement().value;
    this.#prevBlockDomEnv.selectionStart =
      this.#getInputElement().selectionStart;
    const inputEvent = new CustomEvent('input', {
      ...commonComponentEventSetting,
      detail: {
        value: sanitizeInput(this.#prevBlockDomEnv.value), // Sanitize input value
        selectionStart: this.#prevBlockDomEnv.selectionStart,
      },
    });
    this.#dom.dispatchEvent(inputEvent);
    this.#tryToShootComposingEvent();
  };

  #teleportEvent = (e: Event) => {
    if (e.type === 'input') {
      this.#blockHtmlEvent(e as InputEvent);
      return;
    }

    const detail = e.type === 'submit'
      ? { value: (e as unknown as { submitter: unknown }).submitter }
      : {};
    const value = this.#getInputElement().value;

    // Use renameEvent to convert standard event names to Lynx event names
    const eventType = renameEvent[e.type] || e.type;

    const newEvent = new CustomEvent(eventType, {
      ...commonComponentEventSetting,
      detail: {
        ...detail,
        value: sanitizeInput(value), // Sanitize input value
      },
    });
    this.#dom.dispatchEvent(newEvent);
    if (e.type === 'submit') {
      e.preventDefault();
    }
  };

  #tryToShootComposingEvent() {
    if (!this.#enableComposingInput) {
      return;
    }
    if (this.#isComposingInput) {
      return;
    }
    this.#isComposingInput = true;
    this.#shootComposingEvent();

    // Clear any existing timer before setting a new one
    if (this.#scheduledComposingTimer) {
      clearTimeout(this.#scheduledComposingTimer);
    }

    this.#scheduledComposingTimer = self.setTimeout(() => {
      this.#isComposingInput = false;
    }, this.#composingInputInterval);
  }

  #shootComposingEvent() {
    // Ensure the input value is sanitized before sending in the event
    const value = sanitizeInput(this.#getInputElement().value);
    const selectionStart = this.#getInputElement().selectionStart;

    // Use boostedQueueMicrotask for better performance
    boostedQueueMicrotask(() => {
      const inputEvent = new CustomEvent('composing-input', {
        ...commonComponentEventSetting,
        detail: {
          value,
          selectionStart,
        },
      });
      this.#dom.dispatchEvent(inputEvent);
    });
  }

  constructor(dom: HTMLElement) {
    this.#dom = dom;
    const inputElement = this.#getInputElement() as HTMLInputElement;
    const formElement = this.#getFormElement() as HTMLFormElement;

    // Initialize composing input settings
    const attrValue = this.#dom.getAttribute('send-composing-input');
    this.#handleEnableSendComposingInput(attrValue);

    // Enable input event handling
    this.#handleInputEventEnable(true);

    inputElement.addEventListener('blur', this.#teleportEvent, {
      passive: true,
    });
    inputElement.addEventListener('focus', this.#teleportEvent, {
      passive: true,
    });
    formElement.addEventListener('submit', this.#teleportEvent, {
      passive: true,
    });
    // Don't add input listener here since it's handled by #handleInputEventEnable
  }
}
