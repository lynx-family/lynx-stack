/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
} from '../../element-reactive/index.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { registerEventEnableStatusChangeHandler } from '../../element-reactive/index.js';

export class ImageEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [];
  #dom: HTMLElement;
  #pendingLoadEvents: CustomEvent[] = [];

  #getImg = genDomGetter<HTMLImageElement>(() => this.#dom.shadowRoot!, '#img');

  @registerEventEnableStatusChangeHandler('load')
  _enableLoadEvent(status: boolean) {
    if (status) {
      this.#getImg().addEventListener('load', this.#teleportLoadEvent, {
        passive: true,
      });
    } else {
      this.#getImg().removeEventListener('load', this.#teleportLoadEvent);
      this.#pendingLoadEvents = [];
    }
  }

  @registerEventEnableStatusChangeHandler('error')
  _enableErrorEvent(status: boolean) {
    if (status) {
      this.#getImg().addEventListener('error', this.#teleportErrorEvent, {
        passive: true,
      });
    } else {
      this.#getImg().removeEventListener('error', this.#teleportErrorEvent);
    }
  }

  #teleportLoadEvent = () => {
    const event = new CustomEvent('load', {
      ...commonComponentEventSetting,
      detail: {
        width: this.#getImg().naturalWidth,
        height: this.#getImg().naturalHeight,
      },
    });
    if (this.#dom.isConnected) {
      this.#dom.dispatchEvent(event);
    } else {
      // Preserve the dimensions at load time until the host joins the document.
      this.#pendingLoadEvents.push(event);
    }
  };

  connectedCallback() {
    while (this.#dom.isConnected && this.#pendingLoadEvents.length) {
      this.#dom.dispatchEvent(this.#pendingLoadEvents.shift()!);
    }
  }

  #teleportErrorEvent = () => {
    this.#dom.dispatchEvent(
      new CustomEvent('error', {
        ...commonComponentEventSetting,
        detail: {},
      }),
    );
  };

  constructor(dom: HTMLElement) {
    this.#dom = dom;
  }
}
