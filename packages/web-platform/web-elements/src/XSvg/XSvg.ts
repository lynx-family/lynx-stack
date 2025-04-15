/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  Component,
  bindToStyle,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';

export class XSvgFeatures
  implements InstanceType<AttributeReactiveClass<typeof XSvg>>
{
  static observedAttributes = ['src', 'content'];
  #dom: XSvg;
  #loadEventInvoker = new Image();

  @registerAttributeHandler('src', true)
  #handleSrc = bindToStyle(
    () => this.#dom,
    'background-image',
    (src) => {
      this.#loadEventInvoker.src = src;
      return `url(${src})`;
    },
  );

  @registerAttributeHandler('content', true)
  #handleContent = bindToStyle(
    () => this.#dom,
    'background-image',
    (content) => {
      if (!content) return '';
      // https://stackoverflow.com/questions/23223718/failed-to-execute-btoa-on-window-the-string-to-be-encoded-contains-characte
      const src = 'data:image/svg+xml;base64,'
        + btoa(unescape(encodeURIComponent(content)));
      this.#loadEventInvoker.src = src;
      return `url("${src}")`;
    },
  );

  #fireLoadEvent = () => {
    const { width, height } = this.#loadEventInvoker;
    this.#dom.dispatchEvent(
      new CustomEvent('load', {
        ...commonComponentEventSetting,
        detail: {
          width,
          height,
        },
      }),
    );
  };

  constructor(dom: HTMLElement) {
    this.#dom = dom as XSvg;
    this.#loadEventInvoker.addEventListener('load', this.#fireLoadEvent);
  }
}

@Component<typeof XSvg>('x-svg', [CommonEventsAndMethods, XSvgFeatures])
export class XSvg extends HTMLElement {}
