/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import type { AttributeReactiveClass } from '../../element-reactive/index.js';
import type { XRefreshFooter } from './XRefreshFooter.js';
import type { XRefreshHeader } from './XRefreshHeader.js';

export class XRefreshIntersectionObserverEvent extends Event {
  static EventName = 'x-refresh-view-intersecting';
  constructor(
    public startShowing: boolean,
    public fullyShowing: boolean,
  ) {
    super(XRefreshIntersectionObserverEvent.EventName, {
      composed: false,
      cancelable: true,
      bubbles: true,
    });
  }
}

export class XRefreshSubElementIntersectionObserver implements
  InstanceType<
    AttributeReactiveClass<typeof XRefreshHeader | typeof XRefreshFooter>
  >
{
  #dom: XRefreshHeader;
  static observedAttributes = [];
  #intersectionObserver?: IntersectionObserver;
  constructor(dom: XRefreshHeader) {
    this.#dom = dom;
  }
  connectedCallback?(): void {
    if (IntersectionObserver && !this.#intersectionObserver) {
      const parent = this.#dom.parentElement;
      if (parent) {
        this.#intersectionObserver = new IntersectionObserver(
          (intersectionEntries) => {
            let isStartShowing = false;
            let isFullyShowing = false;
            intersectionEntries.forEach((e) => {
              isStartShowing = e.intersectionRatio > 0;
              isFullyShowing = e.intersectionRatio > 0.9;
            });
            this.#dom.dispatchEvent(
              new XRefreshIntersectionObserverEvent(
                isStartShowing,
                isFullyShowing,
              ),
            );
            if (isFullyShowing) {
              this.#dom.setAttribute('x-magnet-enable', '');
            }
          },
          {
            root: parent,
            threshold: [0.1, 0.9], // set to 0.9 to get better user-experience
          },
        );
        this.#intersectionObserver.observe(this.#dom);
      }
    }
  }
  dispose(): void {
    if (this.#intersectionObserver) {
      this.#intersectionObserver.disconnect();
      this.#intersectionObserver = undefined;
    }
  }
}
