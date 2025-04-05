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

export class XTextareaEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['send-composing-input'];
  #dom: HTMLElement;
  #getTextareaElement = genDomGetter<HTMLTextAreaElement>(
    () => this.#dom.shadowRoot!,
    '#textarea',
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
      // Add event listener when enabled
      formElement.addEventListener('input', this.#blockHtmlEvent as any, {
        passive: true,
      });
    } else {
      // Remove event listener when disabled
      formElement.removeEventListener('input', this.#blockHtmlEvent as any);
    }
  }

  #blockHtmlEvent = (e: InputEvent) => {
    e.stopPropagation();
    const textareaElement = this.#getTextareaElement() as HTMLTextAreaElement;
    this.#prevBlockDomEnv.value = textareaElement.value;
    this.#prevBlockDomEnv.selectionStart = textareaElement.selectionStart;
    const inputEvent = new CustomEvent('input', {
      ...commonComponentEventSetting,
      detail: {
        value: sanitizeInput(this.#prevBlockDomEnv.value), // Sanitize textarea input
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
    const textareaElement = this.#getTextareaElement() as HTMLTextAreaElement;
    const value = textareaElement.value;

    // Use renameEvent to get the Lynx equivalent event name
    const eventType = renameEvent[e.type] || e.type;

    const newEvent = new CustomEvent(eventType, {
      ...commonComponentEventSetting,
      detail: {
        ...detail,
        value: sanitizeInput(value), // Sanitize textarea value
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

    // Clear any existing timer to prevent memory leaks
    if (this.#scheduledComposingTimer) {
      clearTimeout(this.#scheduledComposingTimer);
    }

    this.#scheduledComposingTimer = self.setTimeout(() => {
      this.#isComposingInput = false;
    }, this.#composingInputInterval);
  }

  #shootComposingEvent() {
    // Ensure the textarea value is sanitized before sending in the event
    const textareaElement = this.#getTextareaElement() as HTMLTextAreaElement;
    const value = sanitizeInput(textareaElement.value);
    const selectionStart = textareaElement.selectionStart;

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
    const textareaElement = this.#getTextareaElement() as HTMLTextAreaElement;
    const formElement = this.#getFormElement() as HTMLFormElement;

    // Explicitly use the method to avoid the "never read" error
    // Override any attribute with a default if needed
    if (!this.#dom.hasAttribute('send-composing-input')) {
      this.#handleEnableSendComposingInput('500');
    }

    // Enable input event handling
    this.#handleInputEventEnable(true);

    textareaElement.addEventListener('blur', this.#teleportEvent, {
      passive: true,
    });
    textareaElement.addEventListener('focus', this.#teleportEvent, {
      passive: true,
    });
    formElement.addEventListener('submit', this.#teleportEvent, {
      passive: true,
    });
  }
}
