/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '../../element-reactive/index.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { XFoldviewNgEvents } from './XFoldviewNgEvents.js';
import { XFoldviewNgTouchEventsHandler } from './XFoldviewNgTouchEventsHandler.js';
import { scrollContainerDom } from '../common/constants.js';
import { LinearContainer } from '../../compat/index.js';

export const isHeaderShowing = Symbol('isHeaderShowing');
export const updateHeaderHeight = Symbol('updateHeaderHeight');
export const updateToolbarHeight = Symbol('updateToolbarHeight');
export const scrollCallbacks = Symbol('scrollCallbacks');

@Component<typeof XFoldviewNg>('x-foldview-ng', [
  LinearContainer,
  CommonEventsAndMethods,
  XFoldviewNgEvents,
  XFoldviewNgTouchEventsHandler,
])
export class XFoldviewNg extends HTMLElement {
  static readonly notToFilterFalseAttributes = new Set(['scroll-enable']);
  #headerHeight: number = 0;
  #toolbarHeight: number = 0;
  [scrollCallbacks]: Set<() => void> = new Set();

  [updateHeaderHeight](height: number) {
    this.#headerHeight = height;
    this.style.setProperty(
      '--foldview-scroll-height',
      this.scrollHeight + 'px',
    );
  }

  [updateToolbarHeight](height: number) {
    this.#toolbarHeight = height;
    this.style.setProperty(
      '--foldview-scroll-height',
      this.scrollHeight + 'px',
    );
  }

  override get scrollHeight(): number {
    return this.#headerHeight - this.#toolbarHeight;
  }
  get [isHeaderShowing](): boolean {
    // This behavior cannot be reproduced in the current test, but can be reproduced in Android WebView
    return this.scrollHeight - this.scrollTop >= 1;
  }

  get scrollableLength(): number {
    return this.scrollHeight;
  }

  #scrollTop: number = 0;

  override get scrollTop() {
    return this.#scrollTop;
  }

  override set scrollTop(value: number) {
    const maxScroll = Math.max(this.scrollHeight, 0);
    value = Math.max(0, Math.min(value, maxScroll));
    if (this.#scrollTop === value) {
      return;
    }
    this.#scrollTop = value;
    this.style.setProperty(
      '--foldview-scroll-top',
      (0 - value).toString() + 'px',
    );
    this.dispatchEvent(new Event('scroll'));
    for (const callback of this[scrollCallbacks]) {
      callback();
    }
  }

  override scrollTo(options?: ScrollToOptions): void;
  override scrollTo(x: number, y: number): void;
  override scrollTo(arg1?: any, arg2?: any): void {
    if (typeof arg1 === 'object') {
      const { top, behavior } = arg1;
      if (typeof top === 'number') {
        if (behavior === 'smooth') {
          // TODO: implement smooth scroll if needed, for now just instant
          this.scrollTop = top;
        } else {
          this.scrollTop = top;
        }
      }
    } else if (typeof arg2 === 'number') {
      this.scrollTop = arg2;
    }
  }

  override scrollBy(options?: ScrollToOptions): void;
  override scrollBy(x: number, y: number): void;
  override scrollBy(arg1?: any, arg2?: any): void {
    if (typeof arg1 === 'object') {
      const { top, behavior } = arg1;
      this.scrollTo({
        top: (typeof top === 'number' ? top : 0) + this.scrollTop,
        behavior,
      });
    } else {
      this.scrollTo(0, this.scrollTop + (arg2 || 0));
    }
  }

  setFoldExpanded(params: { offset: string; smooth: boolean }) {
    const { offset, smooth = true } = params;
    const offsetValue = parseFloat(offset);
    this.scrollTo({
      top: offsetValue,
      behavior: smooth ? 'smooth' : 'instant',
    });
  }

  get [scrollContainerDom]() {
    return this;
  }
}
