/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
  registerAttributeHandler,
} from '../../element-reactive/index.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { renameEvent } from '../common/renameEvent.js';
import { registerEventEnableStatusChangeHandler } from '../../element-reactive/index.js';

export class XInputEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['send-composing-input', 'input-filter'];
  #dom: HTMLElement;

  #sendComposingInput = false;
  #numberInputFilter = /[^0-9.]|\.(?=.*\.)/g;

  #getInputElement = genDomGetter<HTMLInputElement>(
    () => this.#dom.shadowRoot!,
    '#input',
  );
  #getFormElement = genDomGetter<HTMLInputElement>(
    () => this.#dom.shadowRoot!,
    '#form',
  );

  @registerAttributeHandler('input-filter', true)
  @registerEventEnableStatusChangeHandler('lynxinput')
  _handleEnableInputEvent(status: boolean | string | null) {
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
  _handleSendComposingInput(newVal: string | null) {
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
    const filterValue = this.#filterInputValue(input.value);
    const isComposing = event.isComposing;
    input.value = filterValue;
    if (isComposing && !this.#sendComposingInput) return;
    this.#dom.dispatchEvent(
      new CustomEvent('lynxinput', {
        ...commonComponentEventSetting,
        detail: {
          value: filterValue,
          /** @deprecated */
          textLength: filterValue.length,
          /** @deprecated */
          cursor: input.selectionStart,
          isComposing,
          selectionStart: input.selectionStart,
          selectionEnd: input.selectionEnd,
        },
      }),
    );
  };

  #teleportCompositionendInput = () => {
    const input = this.#getInputElement();
    const filterValue = this.#filterInputValue(input.value);
    input.value = filterValue;
    // if #sendComposingInput set true, #teleportInput will send detail
    if (!this.#sendComposingInput) {
      this.#dom.dispatchEvent(
        new CustomEvent('lynxinput', {
          ...commonComponentEventSetting,
          detail: {
            value: filterValue,
            /** @deprecated */
            textLength: filterValue.length,
            /** @deprecated */
            cursor: input.selectionStart,
            isComposing: false,
            selectionStart: input.selectionStart,
            selectionEnd: input.selectionEnd,
          },
        }),
      );
    }
  };

  #filterInputValue(value: string) {
    let filterValue = value;
    if (this.#dom.getAttribute('type') === 'number') {
      filterValue = filterValue.replace(this.#numberInputFilter, '');
    }
    const inputFilter = this.#dom.getAttribute('input-filter');
    if (inputFilter) {
      filterValue = filterValue.replace(new RegExp(inputFilter, 'g'), '');
    }
    return filterValue;
  }

  @registerEventEnableStatusChangeHandler('selection')
  _handleEnableSelectionEvent(status: boolean) {
    if (status) {
      this.#getInputElement().addEventListener(
        'select',
        this.#selectEvent,
        {
          passive: true,
        },
      );
    } else {
      this.#getInputElement().removeEventListener(
        'select',
        this.#selectEvent,
      );
    }
  }

  #selectEvent = () => {
    const input = this.#getInputElement();
    this.#dom.dispatchEvent(
      new CustomEvent('selection', {
        ...commonComponentEventSetting,
        detail: {
          selectionStart: input.selectionStart,
          selectionEnd: input.selectionEnd,
        },
      }),
    );
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
