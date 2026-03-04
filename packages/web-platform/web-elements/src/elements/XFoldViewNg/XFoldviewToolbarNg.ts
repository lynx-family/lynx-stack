/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '../../element-reactive/index.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { LinearContainer } from '../../compat/index.js';
import { updateToolbarHeight, XFoldviewNg } from './XFoldviewNg.js';

@Component<typeof XFoldviewToolbarNg>('x-foldview-toolbar-ng', [
  LinearContainer,
  CommonEventsAndMethods,
])
export class XFoldviewToolbarNg extends HTMLElement {
  #resizeObserver?: ResizeObserver;

  connectedCallback() {
    this.#resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.#updateParent(entry.contentRect.height);
      }
    });
    this.#resizeObserver.observe(this);
    this.#updateParent(this.clientHeight);
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
  }

  #updateParent(height: number) {
    let parent = this.parentElement;
    while (parent) {
      if (parent instanceof XFoldviewNg) {
        parent[updateToolbarHeight](height);
        break;
      }
      if (parent.tagName !== 'LYNX-WRAPPER') {
        break;
      }
      parent = parent.parentElement;
    }
  }
}
