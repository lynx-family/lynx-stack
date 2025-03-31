/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, genDomGetter, html } from '@lynx-js/web-elements-reactive';
import { Placeholder } from './Placeholder.js';
import { TextareaBaseAttributes } from './TextareaBaseAttributes.js';
import { XTextareaAttributes } from './XTextareaAttributes.js';
import { XTextareaEvents } from './XTextareaEvents.js';
import { LynxExposure } from '../common/Exposure.js';

// x-textarea
@Component(
  'x-textarea',
  [
    LynxExposure,
    Placeholder,
    TextareaBaseAttributes,
    XTextareaAttributes,
    XTextareaEvents,
  ],
  html`<style>
      __textarea:focus,
      __textarea:focus-visible {
        border: inherit;
        outline: inherit;
      }
    </style>
    <form id="form" part="form" method="dialog">
      <textarea id="textarea" part="textarea"></textarea>
    </form> `,
)
export class XTextarea extends HTMLElement {
  __getTextarea = genDomGetter<HTMLTextAreaElement>(
    () => this.shadowRoot!,
    '__textarea',
  );
  get value() {
    return this.__getTextarea().value;
  }
  set value(val: string) {
    this.__getTextarea().value = val;
  }
  addText(params: { text: string }) {
    const { text } = params;
    const input = this.__getTextarea();
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

  setValue(params: { value: string; index: number }) {
    const input = this.__getTextarea();
    input.value = params.value;
    let cursorIndex;
    if ((cursorIndex = params.index)) {
      input.setSelectionRange(cursorIndex, cursorIndex);
    }
  }

  sendDelEvent(params: { action: number; length: number }) {
    let { action, length } = params;
    const input = this.__getTextarea();
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

  select() {
    const input = this.__getTextarea();
    input.setSelectionRange(0, input.value.length);
  }

  setSelectionRange(params: { selectionStart: number; selectionEnd: number }) {
    this.__getTextarea().setSelectionRange(
      params.selectionStart,
      params.selectionEnd,
    );
  }
}
