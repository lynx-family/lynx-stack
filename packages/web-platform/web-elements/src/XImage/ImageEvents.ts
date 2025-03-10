/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';

export class ImageEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [];
  #dom: HTMLElement;

  #getImg = genDomGetter<HTMLImageElement>(() => this.#dom.shadowRoot!, '#img');

  @registerEventEnableStatusChangeHandler('load')
  #enableLoadEvent(status: boolean) {
    if (status) {
      this.#getImg().addEventListener('load', this.#teleportLoadEvent, {
        passive: true,
      });
    } else {
      this.#getImg().removeEventListener('load', this.#teleportLoadEvent);
    }
  }

  @registerEventEnableStatusChangeHandler('error')
  #enableErrorEvent(status: boolean) {
    if (status) {
      this.#getImg().addEventListener('error', this.#teleportErrorEvent, {
        passive: true,
      });
    } else {
      this.#getImg().removeEventListener('error', this.#teleportErrorEvent);
    }
  }

  #teleportLoadEvent = () => {
    this.#dom.dispatchEvent(
      new CustomEvent('load', {
        ...commonComponentEventSetting,
        detail: {
          width: this.#getImg().naturalWidth,
          height: this.#getImg().naturalHeight,
        },
      }),
    );
  };

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
