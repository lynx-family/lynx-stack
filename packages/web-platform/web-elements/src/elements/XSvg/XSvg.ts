/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  Component,
  genDomGetter,
  registerAttributeHandler,
  registerEventEnableStatusChangeHandler,
} from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { templateXSvg } from '@lynx-js/web-elements-template';

export class XSvgFeatures
  implements InstanceType<AttributeReactiveClass<typeof XSvg>>
{
  static observedAttributes = ['src', 'content'];
  #dom: XSvg;
  #url: string | null = null;

  #getImg = genDomGetter<HTMLImageElement>(() => this.#dom.shadowRoot!, '#img');

  @registerAttributeHandler('src', true)
  _handleSrc(newVal: string | null) {
    if (!newVal) {
      this.#getImg().src = '';
    } else {
      this.#getImg().src = newVal;
    }
  }

  @registerAttributeHandler('content', true)
  _handleContent(content: string | null) {
    this.#url && URL.revokeObjectURL(this.#url);
    if (!content) {
      this.#url = '';
      return;
    }
    const blob = new Blob([content], {
      type: 'image/svg+xml;charset=UTF-8',
    });
    const src = URL.createObjectURL(blob);
    this.#url = src;
    this.#getImg().src = src;
  }

  @registerEventEnableStatusChangeHandler('load')
  _enableLoadEvent(status: boolean) {
    if (status) {
      this.#getImg().addEventListener('load', this.#teleportLoadEvent, {
        passive: true,
      });
    } else {
      this.#getImg().removeEventListener('load', this.#teleportLoadEvent);
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

  constructor(dom: HTMLElement) {
    this.#dom = dom as XSvg;
  }
}

@Component<typeof XSvg>(
  'x-svg',
  [CommonEventsAndMethods, XSvgFeatures],
  templateXSvg(),
)
export class XSvg extends HTMLElement {}
