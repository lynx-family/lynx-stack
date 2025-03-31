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
  __dom: XRefreshView;
  static observedAttributes = [];
  __getXRefreshHeader = genDomGetter<XRefreshHeader>(
    () => this.__dom,
    'x-refresh-view > x-refresh-header:first-of-type',
  );
  __getXRefreshFooter = genDomGetter<XRefreshHeader>(
    () => this.__dom,
    'x-refresh-view > x-refresh-footer:first-of-type',
  );
  constructor(dom: XRefreshView) {
    this.__dom = dom;
    this.__dom.addEventListener(
      XRefreshIntersectionObserverEvent.EventName,
      this.__handleSubElementObserverEvent as EventListener,
    );
  }

  __eventSwitches = {
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
  __handleComplexEventEnableAttributes(status: boolean, eventName: string) {
    this
      .__eventSwitches[
        eventName as 'headeroffset' | 'headershow' | 'footeroffset'
      ] = status;
    const { headeroffset, headershow, footeroffset } = this.__eventSwitches;
    if (
      headeroffset
      || headershow
      || footeroffset
    ) {
      this.__enableComplexRefreshViewEvents();
    } else {
      this.__disableComplexRefreshViewEvents();
    }
  }

  @registerEventEnableStatusChangeHandler('startrefresh')
  @registerEventEnableStatusChangeHandler('headerreleased')
  @registerEventEnableStatusChangeHandler('startloadmore')
  @registerEventEnableStatusChangeHandler('footerreleased')
  __handleXEnableHeaderOffsetEvent(status: boolean, eventName: string) {
    this
      .__eventSwitches[
        eventName as
          | 'startrefresh'
          | 'headerreleased'
          | 'startloadmore'
          | 'footerreleased'
      ] = status;
    const { startrefresh, headerreleased, startloadmore, footerreleased } =
      this.__eventSwitches;
    if (
      headerreleased
      || footerreleased
      || startloadmore
      || startrefresh
    ) {
      this.__enableSimpleRefreshViewEvents();
    } else {
      this.__disableSimpleRefreshViewEvents();
    }
  }
  /**
   * handle header/footer showing events
   */
  __headerShowing: boolean = false;
  __headerFullyShown: boolean = false;
  __footerShowing: boolean = false;
  __footerFullyShown: boolean = false;
  __handleSubElementObserverEvent = (e: XRefreshIntersectionObserverEvent) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).tagName === 'X-REFRESH-HEADER') {
      this.__headerShowing = e.startShowing;
      this.__headerFullyShown = e.fullyShowing;
    } else {
      this.__footerShowing = e.startShowing;
      this.__footerFullyShown = e.fullyShowing;
    }
  };

  /**
   * Event without dragging info;
   */
  __simpleRefreshViewEventsEnabled: boolean = false;
  __enableSimpleRefreshViewEvents() {
    if (this.__simpleRefreshViewEventsEnabled) return;
    this.__dom.addEventListener('touchend', this.__handleTouchEndForEvent);
    this.__simpleRefreshViewEventsEnabled = true;
  }
  __handleTouchEndForEvent = () => {
    if (this.__headerFullyShown) {
      this.__dom.dispatchEvent(
        new CustomEvent('headerreleased', commonComponentEventSetting),
      );
      this.__dom.dispatchEvent(
        new CustomEvent('startrefresh', {
          ...commonComponentEventSetting,
          detail: { isManual: this.__dom._nextRefreshIsManual },
        }),
      );
      this.__dom._nextRefreshIsManual = true;
    } else if (
      (this.__dom.getAttribute('enable-auto-loadmore') === 'true'
        && this.__footerShowing)
      || this.__footerFullyShown
    ) {
      this.__dom.dispatchEvent(
        new CustomEvent('footerreleased', commonComponentEventSetting),
      );
      this.__dom.dispatchEvent(
        new CustomEvent('startloadmore', commonComponentEventSetting),
      );
    }
  };

  __disableSimpleRefreshViewEvents() {
    if (this.__simpleRefreshViewEventsEnabled) {
      this.__dom.removeEventListener('touchend', this.__handleTouchEndForEvent);
    }
  }

  /**
   * Event with dragging info
   */
  __dragging: boolean = false;
  __complexRefreshViewEventEnabled: boolean = false;
  __enableComplexRefreshViewEvents() {
    if (this.__complexRefreshViewEventEnabled) return;
    this.__dom.addEventListener(
      'touchstart',
      this.__handleTouchStartForDraggingStatus,
    );
    this.__dom.addEventListener(
      'touchend',
      this.__handleTouchEndForDraggingStatus,
    );
    this.__dom.addEventListener(
      'touchcancel',
      this.__handleTouchEndForDraggingStatus,
    );
    this.__dom
      .shadowRoot!.querySelector('__container')!
      .addEventListener('scroll', this.__handleScroll);
  }
  __handleTouchEndForDraggingStatus = () => {
    this.__dragging = false;
  };
  __handleTouchStartForDraggingStatus = () => {
    this.__dragging = true;
  };
  __handleScroll = () => {
    if (
      this.__headerShowing
      && (this.__eventSwitches.headershow || this.__eventSwitches.headeroffset)
    ) {
      const header = this.__getXRefreshHeader();
      if (header) {
        const height = parseFloat(getComputedStyle(header).height);
        const scrollTop =
          this.__dom.shadowRoot!.querySelector('__container')!.scrollTop;
        this.__dom.dispatchEvent(
          new CustomEvent('headershow', {
            ...commonComponentEventSetting,
            detail: {
              isDragging: this.__dragging,
              offsetPercent: 1 - scrollTop / height,
            },
          }),
        );
        this.__dom.dispatchEvent(
          new CustomEvent('headeroffset', {
            ...commonComponentEventSetting,
            detail: {
              isDragging: this.__dragging,
              offsetPercent: 1 - scrollTop / height,
            },
          }),
        );
      }
    } else if (this.__footerShowing && this.__eventSwitches.footeroffset) {
      const footer = this.__getXRefreshFooter();
      if (footer) {
        const contentDom = this.__dom.shadowRoot!.querySelector('__container')!;
        const scrollTop = contentDom.scrollTop;
        const scrollHeight = contentDom.scrollHeight;
        const height = parseFloat(getComputedStyle(footer).height);
        this.__dom.dispatchEvent(
          new CustomEvent('footeroffset', {
            ...commonComponentEventSetting,
            detail: {
              isDragging: this.__dragging,
              offsetPercent: 1 - scrollTop / height,
            },
          }),
        );
      }
    }
  };
  __disableComplexRefreshViewEvents() {
    if (this.__complexRefreshViewEventEnabled) {
      this.__dom.removeEventListener(
        'touchstart',
        this.__handleTouchStartForDraggingStatus,
      );
      this.__dom.removeEventListener(
        'touchend',
        this.__handleTouchEndForDraggingStatus,
      );
      this.__dom.removeEventListener(
        'touchcancel',
        this.__handleTouchEndForDraggingStatus,
      );
      this.__dom
        .shadowRoot!.querySelector('__container')!
        .removeEventListener('scroll', this.__handleScroll);
    }
  }
  dispose(): void {
    this.__disableSimpleRefreshViewEvents();
    this.__disableComplexRefreshViewEvents();
  }
}
