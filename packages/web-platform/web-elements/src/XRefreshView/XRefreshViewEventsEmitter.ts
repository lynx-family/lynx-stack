/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
} from '@lynx-js/web-elements-reactive';
import type { XRefreshHeader } from './XRefreshHeader.js';
import { XRefreshIntersectionObserverEvent } from './XRefreshSubElementIntersectionObserver.js';
import type { XRefreshView } from './XRefreshView.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';

export class XRefreshViewEventsEmitter
  implements InstanceType<AttributeReactiveClass<typeof XRefreshView>>
{
  #dom: XRefreshView;
  static observedAttributes = [];
  #getXRefreshHeader = genDomGetter<XRefreshHeader>(
    () => this.#dom,
    'x-refresh-view > x-refresh-header:first-of-type',
  );
  #getXRefreshFooter = genDomGetter<XRefreshHeader>(
    () => this.#dom,
    'x-refresh-view > x-refresh-footer:first-of-type',
  );
  constructor(dom: XRefreshView) {
    this.#dom = dom;
    this.#dom.addEventListener(
      XRefreshIntersectionObserverEvent.EventName,
      this.#handleSubElementObserverEvent as EventListener,
    );
  }

  #eventSwitches = {
    headeroffset: false,
    headerreleased: false,
    startrefresh: false,
    footeroffset: false,
    headershow: false,
    footerreleased: false,
    startloadmore: false,
  };

  // complex events switches
  @registerEventEnableStatusChangeHandler('headeroffset')
  @registerEventEnableStatusChangeHandler('headershow')
  @registerEventEnableStatusChangeHandler('footeroffset')
  #handleComplexEventEnableAttributes(status: boolean, eventName: string) {
    this
      .#eventSwitches[
        eventName as 'headeroffset' | 'headershow' | 'footeroffset'
      ] = status;
    const { headeroffset, headershow, footeroffset } = this.#eventSwitches;
    if (
      headeroffset
      || headershow
      || footeroffset
    ) {
      this.#enableComplexRefreshViewEvents();
    } else {
      this.#disableComplexRefreshViewEvents();
    }
  }

  @registerEventEnableStatusChangeHandler('startrefresh')
  @registerEventEnableStatusChangeHandler('headerreleased')
  @registerEventEnableStatusChangeHandler('startloadmore')
  @registerEventEnableStatusChangeHandler('footerreleased')
  #handleXEnableHeaderOffsetEvent(status: boolean, eventName: string) {
    this
      .#eventSwitches[
        eventName as
          | 'startrefresh'
          | 'headerreleased'
          | 'startloadmore'
          | 'footerreleased'
      ] = status;
    const { startrefresh, headerreleased, startloadmore, footerreleased } =
      this.#eventSwitches;
    if (
      headerreleased
      || footerreleased
      || startloadmore
      || startrefresh
    ) {
      this.#enableSimpleRefreshViewEvents();
    } else {
      this.#disableSimpleRefreshViewEvents();
    }
  }
  /**
   * handle header/footer showing events
   */
  #headerShowing: boolean = false;
  #headerFullyShown: boolean = false;
  #footerShowing: boolean = false;
  #footerFullyShown: boolean = false;
  #handleSubElementObserverEvent = (e: XRefreshIntersectionObserverEvent) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).tagName === 'X-REFRESH-HEADER') {
      this.#headerShowing = e.startShowing;
      this.#headerFullyShown = e.fullyShowing;
    } else {
      this.#footerShowing = e.startShowing;
      this.#footerFullyShown = e.fullyShowing;
    }
  };

  /**
   * Event without dragging info;
   */
  #simpleRefreshViewEventsEnabled: boolean = false;
  #enableSimpleRefreshViewEvents() {
    if (this.#simpleRefreshViewEventsEnabled) return;
    this.#dom.addEventListener('touchend', this.#handleTouchEndForEvent);
    this.#simpleRefreshViewEventsEnabled = true;
  }
  #handleTouchEndForEvent = () => {
    if (this.#headerFullyShown) {
      this.#dom.dispatchEvent(
        new CustomEvent('headerreleased', commonComponentEventSetting),
      );
      this.#dom.dispatchEvent(
        new CustomEvent('startrefresh', {
          ...commonComponentEventSetting,
          detail: { isManual: this.#dom._nextRefreshIsManual },
        }),
      );
      this.#dom._nextRefreshIsManual = true;
    } else if (
      (this.#dom.getAttribute('enable-auto-loadmore') === 'true'
        && this.#footerShowing)
      || this.#footerFullyShown
    ) {
      this.#dom.dispatchEvent(
        new CustomEvent('footerreleased', commonComponentEventSetting),
      );
      this.#dom.dispatchEvent(
        new CustomEvent('startloadmore', commonComponentEventSetting),
      );
    }
  };

  #disableSimpleRefreshViewEvents() {
    if (this.#simpleRefreshViewEventsEnabled) {
      this.#dom.removeEventListener('touchend', this.#handleTouchEndForEvent);
    }
  }

  /**
   * Event with dragging info
   */
  #dragging: boolean = false;
  #complexRefreshViewEventEnabled: boolean = false;
  #enableComplexRefreshViewEvents() {
    if (this.#complexRefreshViewEventEnabled) return;
    this.#dom.addEventListener(
      'touchstart',
      this.#handleTouchStartForDraggingStatus,
    );
    this.#dom.addEventListener(
      'touchend',
      this.#handleTouchEndForDraggingStatus,
    );
    this.#dom.addEventListener(
      'touchcancel',
      this.#handleTouchEndForDraggingStatus,
    );
    this.#dom
      .shadowRoot!.querySelector('#container')!
      .addEventListener('scroll', this.#handleScroll);
  }
  #handleTouchEndForDraggingStatus = () => {
    this.#dragging = false;
  };
  #handleTouchStartForDraggingStatus = () => {
    this.#dragging = true;
  };
  #handleScroll = () => {
    if (
      this.#headerShowing
      && (this.#eventSwitches.headershow || this.#eventSwitches.headeroffset)
    ) {
      const header = this.#getXRefreshHeader();
      if (header) {
        const height = parseFloat(getComputedStyle(header).height);
        const scrollTop =
          this.#dom.shadowRoot!.querySelector('#container')!.scrollTop;
        this.#dom.dispatchEvent(
          new CustomEvent('headershow', {
            ...commonComponentEventSetting,
            detail: {
              isDragging: this.#dragging,
              offsetPercent: 1 - scrollTop / height,
            },
          }),
        );
        this.#dom.dispatchEvent(
          new CustomEvent('headeroffset', {
            ...commonComponentEventSetting,
            detail: {
              isDragging: this.#dragging,
              offsetPercent: 1 - scrollTop / height,
            },
          }),
        );
      }
    } else if (this.#footerShowing && this.#eventSwitches.footeroffset) {
      const footer = this.#getXRefreshFooter();
      if (footer) {
        const contentDom = this.#dom.shadowRoot!.querySelector('#container')!;
        const scrollTop = contentDom.scrollTop;
        const scrollHeight = contentDom.scrollHeight;
        const height = parseFloat(getComputedStyle(footer).height);
        this.#dom.dispatchEvent(
          new CustomEvent('footeroffset', {
            ...commonComponentEventSetting,
            detail: {
              isDragging: this.#dragging,
              offsetPercent: 1 - scrollTop / height,
            },
          }),
        );
      }
    }
  };
  #disableComplexRefreshViewEvents() {
    if (this.#complexRefreshViewEventEnabled) {
      this.#dom.removeEventListener(
        'touchstart',
        this.#handleTouchStartForDraggingStatus,
      );
      this.#dom.removeEventListener(
        'touchend',
        this.#handleTouchEndForDraggingStatus,
      );
      this.#dom.removeEventListener(
        'touchcancel',
        this.#handleTouchEndForDraggingStatus,
      );
      this.#dom
        .shadowRoot!.querySelector('#container')!
        .removeEventListener('scroll', this.#handleScroll);
    }
  }
  dispose(): void {
    this.#disableSimpleRefreshViewEvents();
    this.#disableComplexRefreshViewEvents();
  }
}
