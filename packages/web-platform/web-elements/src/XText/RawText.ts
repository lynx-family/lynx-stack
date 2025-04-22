/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  Component,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';

export class RawTextAttributes {
  static observedAttributes = ['text'];
  readonly #dom: HTMLElement;
  #text?: Text;

  constructor(currentElement: HTMLElement) {
    this.#dom = currentElement;
  }
  @registerAttributeHandler('text', true)
  #handleText(newVal: string | null) {
    this.#text?.remove();
    if (newVal) {
      this.#text = new Text(newVal);
      this.#dom.append(this.#text);
    }
  }
}

@Component<typeof RawText>('raw-text', [RawTextAttributes])
export class RawText extends HTMLElement {}
