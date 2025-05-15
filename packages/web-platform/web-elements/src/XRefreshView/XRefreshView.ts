/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, genDomGetter } from '@lynx-js/web-elements-reactive';
import { XRefreshViewEventsEmitter } from './XRefreshViewEventsEmitter.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { scrollContainerDom } from '../common/constants.js';
import { templateXRefreshView } from '@lynx-js/web-elements-template';

@Component(
  'x-refresh-view',
  [CommonEventsAndMethods, XRefreshViewEventsEmitter],
  templateXRefreshView,
)
export class XRefreshView extends HTMLElement {
  static readonly notToFilterFalseAttributes = new Set([
    'enable-refresh',
    'enable-loadmore',
    'enable-auto-loadmore',
  ]);
  _nextRefreshIsManual: boolean = true;

  public finishRefresh() {
    this.querySelector(
      'x-refresh-view > x-refresh-header:first-of-type',
    )?.removeAttribute('x-magnet-enable');
  }
  public finishLoadMore() {
    this.querySelector(
      'x-refresh-view > x-refresh-footer:first-of-type',
    )?.removeAttribute('x-magnet-enable');
  }
  public autoStartRefresh() {
    const content = this.shadowRoot!.querySelector('#container')!;
    this.querySelector(
      'x-refresh-view > x-refresh-header:first-of-type',
    )?.setAttribute('x-magnet-enable', '');
    this._nextRefreshIsManual = false;
    content.scroll({
      top: 0,
      behavior: 'smooth',
    });
  }

  #getOverScrollContainer = genDomGetter(() => this.shadowRoot!, '#container');
  #getContentContainer = genDomGetter(() => this.shadowRoot!, '#content');
  override get scrollTop() {
    const outer = this.#getOverScrollContainer();
    const inner = this.#getContentContainer();
    return inner.scrollTop + inner.offsetTop - outer.scrollTop;
  }
  override set scrollTop(val: number) {
    console.log(val);
    const outer = this.#getOverScrollContainer();
    const inner = this.#getContentContainer();
    if (val > 0) {
      inner.scrollTop = val;
    } else {
      outer.scrollTop = inner.offsetTop + val;
    }
  }
  override get scrollHeight() {
    const inner = this.#getContentContainer();
    return inner.scrollHeight;
  }

  get [scrollContainerDom]() {
    return this;
  }
}
