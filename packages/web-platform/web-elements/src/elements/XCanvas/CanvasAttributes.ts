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
} from '../../element-reactive/index.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import type { XCanvas } from './XCanvas.js';

export class CanvasAttributes
  implements InstanceType<AttributeReactiveClass<typeof XCanvas>>
{
  static observedAttributes = ['name', 'height', 'width'];
  #dom: XCanvas;
  #resizeObserver?: ResizeObserver;

  #getCanvas = genDomGetter<HTMLCanvasElement>(
    () => this.#dom.shadowRoot!,
    '#canvas',
  );

  constructor(dom: XCanvas) {
    this.#dom = dom as XCanvas;
  }

  @registerAttributeHandler('name', true)
  handleName = bindToAttribute(this.#getCanvas, 'name');

  @registerAttributeHandler('height', true)
  handleHeight = bindToAttribute(this.#getCanvas, 'height');

  @registerAttributeHandler('width', true)
  handleWidth = bindToAttribute(this.#getCanvas, 'width');

  #resizeHandler: ResizeObserverCallback = (entries: ResizeObserverEntry[]) => {
    const { contentRect } = entries[0]!;
    const canvas = this.#dom.shadowRoot!.firstElementChild as HTMLCanvasElement;
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

  #startResizeObserver() {
    if (!this.#resizeObserver) {
      this.#resizeObserver = new ResizeObserver(this.#resizeHandler);
      this.#resizeObserver.observe(this.#dom);
    }
  }

  #stopResizeObserver() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
  }

  connectedCallback(): void {
    this.#startResizeObserver();
  }

  dispose(): void {
    this.#stopResizeObserver();
  }
}
