/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  Component,
  registerAttributeHandler,
} from '../../element-reactive/index.js';

export class RawTextAttributes {
  static observedAttributes = ['text'];
  readonly #dom: HTMLElement;
  #text?: Text;
  #pendingText?: string | null;

  constructor(currentElement: HTMLElement) {
    this.#dom = currentElement;
  }

  #syncText(newVal: string | null) {
    if (
      newVal
      && this.#text?.parentNode === this.#dom
      && this.#text.data === newVal
    ) {
      return;
    }
    if (!this.#text && newVal) {
      const lastChild = this.#dom.lastChild;
      if (lastChild?.nodeType === 3 && (lastChild as Text).data === newVal) {
        this.#text = lastChild as Text;
        return;
      }
    }
    this.#text?.remove();
    this.#text = undefined;
    if (newVal) {
      this.#text = new Text(newVal);
      this.#dom.append(this.#text);
    }
  }

  @registerAttributeHandler('text', true)
  _handleText(newVal: string | null) {
    this.#pendingText = newVal;
    if (!this.#dom.isConnected) {
      return;
    }
    this.#syncText(newVal);
  }

  connectedCallback() {
    const val = this.#pendingText !== undefined
      ? this.#pendingText
      : this.#dom.getAttribute('text');
    this.#syncText(val);
  }
}

@Component<typeof RawText>('raw-text', [RawTextAttributes])
export class RawText extends HTMLElement {}
