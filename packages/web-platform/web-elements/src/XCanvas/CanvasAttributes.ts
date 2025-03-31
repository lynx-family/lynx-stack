/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindToAttribute,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import type { XCanvas } from './XCanvas.js';

export class CanvasAttributes
  implements InstanceType<AttributeReactiveClass<typeof XCanvas>>
{
  static observedAttributes = ['name', 'height', 'width'];
  __dom: XCanvas;
  __resizeObserver?: ResizeObserver;

  __getCanvas = genDomGetter<HTMLCanvasElement>(
    () => this.__dom.shadowRoot!,
    '__canvas',
  );

  constructor(dom: XCanvas) {
    this.__dom = dom as XCanvas;
  }

  @registerAttributeHandler('name', true)
  handleName = bindToAttribute(this.__getCanvas, 'name');

  @registerAttributeHandler('height', true)
  handleHeight = bindToAttribute(this.__getCanvas, 'height');

  @registerAttributeHandler('height', true)
  handleWidth = bindToAttribute(this.__getCanvas, 'width');

  __resizeHandler: ResizeObserverCallback = (
    entries: ResizeObserverEntry[],
  ) => {
    const { contentRect } = entries[0]!;
    const canvas = this.__dom.shadowRoot!
      .firstElementChild as HTMLCanvasElement;
    if (canvas) {
      let { height, width } = contentRect;
      height = height * window.devicePixelRatio;
      width = width * window.devicePixelRatio;
      const resizeEvent = new CustomEvent('resize', {
        ...commonComponentEventSetting,
        detail: {
          height,
          width,
        },
      });
      (resizeEvent as any).height = height;
      (resizeEvent as any).width = width;
      canvas.dispatchEvent(resizeEvent);
    }
  };

  __startResizeObserver() {
    if (!this.__resizeObserver) {
      this.__resizeObserver = new ResizeObserver(this.__resizeHandler);
      this.__resizeObserver.observe(this.__dom);
    }
  }

  __stopResizeObserver() {
    this.__resizeObserver?.disconnect();
    this.__resizeObserver = undefined;
  }

  connectedCallback(): void {
    this.__startResizeObserver();
  }

  dispose(): void {
    this.__stopResizeObserver();
  }
}
