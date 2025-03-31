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
  readonly __dom: HTMLElement;

  constructor(currentElement: HTMLElement) {
    this.__dom = currentElement;
  }
  @registerAttributeHandler('text', true)
  __handleText(newVal: string | null) {
    if (newVal) {
      this.__dom.innerHTML = newVal;
    } else {
      this.__dom.innerHTML = '';
    }
  }
}

@Component<typeof RawText>('raw-text', [RawTextAttributes])
export class RawText extends HTMLElement {}
