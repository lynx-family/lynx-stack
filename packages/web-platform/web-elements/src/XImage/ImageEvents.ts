/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';

export class ImageEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = ['x-enable-load-event', 'x-enable-error-event'];
  #dom: HTMLElement;

  #getImg = genDomGetter<HTMLImageElement>(() => this.#dom.shadowRoot!, '#img');

  @registerAttributeHandler('x-enable-load-event', true)
  #enableLoadEvent(value: string | null) {
    if (value === null) {
      this.#getImg().removeEventListener('load', this.#teleportLoadEvent);
    } else {
      this.#getImg().addEventListener('load', this.#teleportLoadEvent, {
        passive: true,
      });
    }
  }

  @registerAttributeHandler('x-enable-error-event', true)
  #enableErrorEvent(value: string | null) {
    if (value === null) {
      this.#getImg().removeEventListener('error', this.#teleportErrorEvent);
    } else {
      this.#getImg().addEventListener('error', this.#teleportErrorEvent, {
        passive: true,
      });
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
