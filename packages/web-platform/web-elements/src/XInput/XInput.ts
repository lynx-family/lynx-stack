/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, genDomGetter, html } from '@lynx-js/web-elements-reactive';

import { InputBaseAttributes } from './InputBaseAttributes.js';
import { Placeholder } from './Placeholder.js';
import { XInputAttribute } from './XInputAttribute.js';
import { XInputEvents } from './XInputEvents.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';

@Component<typeof XInput>(
  'x-input',
  [
    CommonEventsAndMethods,
    Placeholder,
    XInputAttribute,
    InputBaseAttributes,
    XInputEvents,
  ],
  html` <style>
      #input:focus {
        outline: none;
      }
      #form {
        display: none;
      }
    </style>
    <form id="form" part="form" method="dialog">
      <input
        id="input"
        part="input"
        step="any"
        type="text"
        inputmode="text"
        spell-check="true"
      />
    </form>`,
)
export class XInput extends HTMLElement {
  #getInput = genDomGetter<HTMLInputElement>(() => this.shadowRoot!, '#input');

  addText(params: { text: string }) {
    const { text } = params;
    const input = this.#getInput();
    const selectionStart = input.selectionStart;
    if (selectionStart === null) {
      input.value = text;
    } else {
      const currentValue = input.value;
      input.value = currentValue.slice(0, selectionStart)
        + text
        + currentValue.slice(selectionStart);
    }
  }

  controlKeyBoard(params: { action: number }) {
    const { action } = params;
    if (action === 0 || action === 1) {
      this.focus();
    } else if (action === 2 || action === 3) {
      this.blur();
    }
  }

  setValue(params: { value: string; index: number }) {
    const input = this.#getInput();
    input.value = params.value;
    let cursorIndex;
    if ((cursorIndex = params.index)) {
      input.setSelectionRange(cursorIndex, cursorIndex);
    }
  }

  sendDelEvent(params: { action: number; length: number }) {
    let { action, length } = params;
    const input = this.#getInput();
    if (action === 1) {
      length = 1;
    }
    const selectionStart = input.selectionStart;
    if (selectionStart === null) {
      const currentValue = input.value;
      input.value = input.value.substring(0, currentValue.length - length);
    } else {
      const currentValue = input.value;
      input.value = currentValue.slice(0, selectionStart - length)
        + currentValue.slice(selectionStart);
    }
  }

  setInputFilter(params: { pattern: string }) {
    this.#getInput().setAttribute('pattern', params.pattern);
  }

  select() {
    const input = this.#getInput();
    input.setSelectionRange(0, input.value.length);
  }

  setSelectionRange(params: { selectionStart: number; selectionEnd: number }) {
    this.#getInput().setSelectionRange(
      params.selectionStart,
      params.selectionEnd,
    );
  }

  override focus(options?: FocusOptions): void {
    this.#getInput().focus(options);
  }

  override blur(): void {
    this.#getInput().blur();
  }

  connectedCallback() {
    const input = this.#getInput();
    if (this.getAttribute('confirm-type') === null) {
      input.setAttribute('confirm-type', 'send');
    }
    if (this.getAttribute('maxlength') === null) {
      input.setAttribute('maxlength', '140');
    }
  }
}
