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
import { LynxExposure } from '../common/Exposure.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';

export class XSvgFeatures
  implements InstanceType<AttributeReactiveClass<typeof XSvg>>
{
  static observedAttributes = ['src', 'content'];
  __dom: XSvg;
  __loadEventInvoker = new Image();

  @registerAttributeHandler('src', true)
  __handleSrc = bindToStyle(
    () => this.__dom,
    'background-image',
    (src) => {
      this.__loadEventInvoker.src = src;
      return `url(${src})`;
    },
  );

  @registerAttributeHandler('content', true)
  __handleContent = bindToStyle(
    () => this.__dom,
    'background-image',
    (content) => {
      if (!content) return '';
      // https://stackoverflow.com/questions/23223718/failed-to-execute-btoa-on-window-the-string-to-be-encoded-contains-characte
      const src = 'data:image/svg+xml;base64,'
        + btoa(unescape(encodeURIComponent(content)));
      this.__loadEventInvoker.src = src;
      return `url("${src}")`;
    },
  );

  __fireLoadEvent = () => {
    const { width, height } = this.__loadEventInvoker;
    this.__dom.dispatchEvent(
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
    this.__dom = dom as XSvg;
    this.__loadEventInvoker.addEventListener('load', this.__fireLoadEvent);
  }
}

@Component<typeof XSvg>('x-svg', [LynxExposure, XSvgFeatures])
export class XSvg extends HTMLElement {}
