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
  #connected = false;

  constructor(currentElement: HTMLElement) {
    this.#dom = currentElement;
  }

  #syncText(newVal: string | null) {
    if (this.#dom.childNodes.length > 0) {
      this.#dom.replaceChildren();
      this.#text = undefined;
    } else {
      this.#text?.remove();
      this.#text = undefined;
    }
    if (newVal) {
      this.#text = new Text(newVal);
      this.#dom.append(this.#text);
    }
  }

  connectedCallback() {
    this.#connected = true;
    if (this.#dom.hasAttribute('text')) {
      // Template and SSR nodes can carry parsed or cloned light children before
      // upgrade. Rebuild once on connect so the text attribute owns exactly one
      // internal text node and disconnected template construction stays inert.
      this.#syncText(this.#dom.getAttribute('text'));
    }
  }

  dispose() {
    this.#connected = false;
  }

  @registerAttributeHandler('text', true)
  _handleText(newVal: string | null) {
    if (this.#connected) {
      this.#syncText(newVal);
    }
  }
}

@Component<typeof RawText>('raw-text', [RawTextAttributes])
export class RawText extends HTMLElement {}
