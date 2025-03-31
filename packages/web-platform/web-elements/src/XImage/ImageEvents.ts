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
  __dom: HTMLElement;

  __getImg = genDomGetter<HTMLImageElement>(
    () => this.__dom.shadowRoot!,
    '__img',
  );

  @registerEventEnableStatusChangeHandler('load')
  __enableLoadEvent(status: boolean) {
    if (status) {
      this.__getImg().addEventListener('load', this.__teleportLoadEvent, {
        passive: true,
      });
    } else {
      this.__getImg().removeEventListener('load', this.__teleportLoadEvent);
    }
  }

  @registerEventEnableStatusChangeHandler('error')
  __enableErrorEvent(status: boolean) {
    if (status) {
      this.__getImg().addEventListener('error', this.__teleportErrorEvent, {
        passive: true,
      });
    } else {
      this.__getImg().removeEventListener('error', this.__teleportErrorEvent);
    }
  }

  __teleportLoadEvent = () => {
    this.__dom.dispatchEvent(
      new CustomEvent('load', {
        ...commonComponentEventSetting,
        detail: {
          width: this.__getImg().naturalWidth,
          height: this.__getImg().naturalHeight,
        },
      }),
    );
  };

  __teleportErrorEvent = () => {
    this.__dom.dispatchEvent(
      new CustomEvent('error', {
        ...commonComponentEventSetting,
        detail: {},
      }),
    );
  };

  constructor(dom: HTMLElement) {
    this.__dom = dom;
  }
}
