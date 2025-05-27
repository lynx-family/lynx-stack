// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { convertLengthToPx } from './convertLengthToPx.js';
import { commonComponentEventSetting } from './commonEventInitConfiguration.js';
import { scrollContainerDom } from './constants.js';
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';

export const layoutChangeTarget = Symbol('layoutChangeTarget');

export interface ExposureParameters {
  exposureID: string | null;
  exposureArea: string | null;
  exposureScene: string | null;
  exposureScreenMarginTop: string | null;
  exposureScreenMarginRight: string | null;
  exposureScreenMarginBottom: string | null;
  exposureScreenMarginLeft: string | null;
  exposureUIMarginTop: string | null;
  exposureUIMarginRight: string | null;
  exposureUIMarginBottom: string | null;
  exposureUIMarginLeft: string | null;
}

export interface ExposureEvent {
  'exposure-id': string;
  'exposure-scene': string;
  exposureID: string;
  exposureScene: string;
}

export class CommonEventsAndMethods {
  static readonly observedAttributes = [
    'exposure-id',
    'exposure-area',
    'exposure-screen-margin-top',
    'exposure-screen-margin-right',
    'exposure-screen-margin-bottom',
    'exposure-screen-margin-left',
    'exposure-ui-margin-top',
    'exposure-ui-margin-right',
    'exposure-ui-margin-bottom',
    'exposure-ui-margin-left',
  ];

  #uiAppearEnabled = false;
  #uiDisappearEnabled = false;

  readonly #dom: HTMLElement & { [layoutChangeTarget]?: HTMLElement };

  /**
   * Stores a promise. We will handler the exposure attribute change after all related life-cycle events has been fired by browser.
   */
  #afterAttributeChanged?: Promise<void>;

  /**
   * If this dom is already exposured
   */
  #exposureTriggered = false;

  /**
   * keeps the observer of current dom
   */
  #exposureObserver?: IntersectionObserver;

  get #exposureEnabled() {
    return (
      this.#uiAppearEnabled
      || this.#uiDisappearEnabled
      || this.#dom.getAttribute('exposure-id') !== null
    );
  }

  constructor(
    currentElement: HTMLElement & { [layoutChangeTarget]?: HTMLElement },
  ) {
    this.#dom = currentElement;
  }

  onExposureParamsChanged = () => {
    if (!this.#afterAttributeChanged) {
      this.#afterAttributeChanged = Promise.resolve().then(() => {
        this.#updateExposure();
        this.#afterAttributeChanged = undefined;
      });
    }
  };

  onExposureIdChanged(_: string | null, oldValue: string | null) {
    if (oldValue) {
      if (this.#exposureEnabled) {
        this.#sendOneExposureEvent({ isIntersecting: false }, oldValue);
      }
    }
    this.onExposureParamsChanged();
  }
  attributeChangedHandler = new Proxy(this, {
    get(target, attribute: string) {
      if (CommonEventsAndMethods.observedAttributes.includes(attribute)) {
        if (attribute === 'exposure-id') {
          return { handler: target.onExposureIdChanged, noDomMeasure: true };
        } else {
          return {
            handler: target.onExposureParamsChanged,
            noDomMeasure: true,
          };
        }
      }
      return;
    },
  });

  eventStatusChangedHandler = {
    'uiappear': (status: boolean) => {
      this.#uiAppearEnabled = status;
      this.onExposureParamsChanged();
    },
    'uidisappear': (status: boolean) => {
      this.#uiDisappearEnabled = status;
      this.onExposureParamsChanged();
    },
  };

  #updateExposure() {
    const newParams: ExposureParameters = {
      exposureID: this.#dom.getAttribute('exposure-id'),
      exposureArea: this.#dom.getAttribute('exposure-area'),
      exposureScene: this.#dom.getAttribute('exposure-scene'),
      exposureScreenMarginTop: this.#dom.getAttribute(
        'exposure-screen-margin-top',
      ),
      exposureScreenMarginRight: this.#dom.getAttribute(
        'exposure-screen-margin-right',
      ),
      exposureScreenMarginBottom: this.#dom.getAttribute(
        'exposure-screen-margin-bottom',
      ),
      exposureScreenMarginLeft: this.#dom.getAttribute(
        'exposure-screen-margin-left',
      ),
      exposureUIMarginTop: this.#dom.getAttribute(
        'exposure-ui-margin-top',
      ),
      exposureUIMarginRight: this.#dom.getAttribute(
        'exposure-ui-margin-right',
      ),
      exposureUIMarginBottom: this.#dom.getAttribute(
        'exposure-ui-margin-bottom',
      ),
      exposureUIMarginLeft: this.#dom.getAttribute(
        'exposure-ui-margin-left',
      ),
    };
    if (this.#exposureEnabled) {
      if (IntersectionObserver) {
        const uiMargin = {
          top: convertLengthToPx(
            this.#dom,
            newParams.exposureUIMarginTop,
          ),
          right: convertLengthToPx(
            this.#dom,
            newParams.exposureUIMarginRight,
            true,
          ),
          bottom: convertLengthToPx(
            this.#dom,
            newParams.exposureUIMarginBottom,
          ),
          left: convertLengthToPx(
            this.#dom,
            newParams.exposureUIMarginLeft,
            true,
          ),
        };
        const screenMargin = {
          top: convertLengthToPx(
            this.#dom,
            newParams.exposureScreenMarginTop,
          ),
          right: convertLengthToPx(
            this.#dom,
            newParams.exposureScreenMarginRight,
            true,
          ),
          bottom: convertLengthToPx(
            this.#dom,
            newParams.exposureScreenMarginBottom,
          ),
          left: convertLengthToPx(
            this.#dom,
            newParams.exposureScreenMarginLeft,
            true,
          ),
        };
        /**
         * TODO: @haoyang.wang support the switch `enableExposureUIMargin`
         */
        const calcedRootMargin = {
          top: (uiMargin.bottom ? -1 : 1)
            * (screenMargin.top - uiMargin.bottom),
          right: (uiMargin.left ? -1 : 1)
            * (screenMargin.right - uiMargin.left),
          bottom: (uiMargin.top ? -1 : 1)
            * (screenMargin.bottom - uiMargin.top),
          left: (uiMargin.right ? -1 : 1)
            * (screenMargin.left - uiMargin.right),
        };
        const exposureArea = this.#dom.getAttribute('exposure-area');
        const rootMargin =
          `${calcedRootMargin.top}px ${calcedRootMargin.right}px ${calcedRootMargin.bottom}px ${calcedRootMargin.left}px`;
        const threshold = exposureArea ? parseFloat(exposureArea) / 100 : 0;
        if (this.#exposureObserver) {
          this.#exposureObserver.disconnect();
        }

        /**
         * Get the closest scrollable ancestor
         */
        let root: HTMLElement | null = this.#dom.parentElement;
        while (root) {
          // @ts-expect-error
          if (root[scrollContainerDom]) {
            // @ts-expect-error
            root = root[scrollContainerDom];
            break;
          } else {
            root = root.parentElement;
          }
        }
        this.#exposureTriggered = false;
        this.#exposureObserver = new IntersectionObserver(
          ([entry]) => {
            if (entry) {
              if (entry.isIntersecting) {
                this.#exposureTriggered = true;
              }
              this.#sendOneExposureEvent(entry);
            }
          },
          {
            rootMargin,
            threshold,
            root,
          },
        );
        this.#exposureObserver.observe(this.#dom);
      }
    } else {
      this.#disableExposure();
    }
  }

  #sendOneExposureEvent(
    entry: IntersectionObserverEntry | { isIntersecting: boolean },
    overrideExposureId?: string,
  ) {
    if (!this.#exposureTriggered) {
      return;
    }
    const exposureID = overrideExposureId
      ?? this.#dom.getAttribute('exposure-id') ?? '';
    const exposureScene = this.#dom.getAttribute('exposure-scene')
      ?? '';
    const detail = {
      'exposure-id': exposureID,
      'exposure-scene': exposureScene,
      exposureID,
      exposureScene,
    };
    const appearEvent = new CustomEvent(
      entry.isIntersecting ? 'uiappear' : 'uidisappear',
      {
        ...commonComponentEventSetting,
        detail,
      },
    );
    const exposureEvent = new CustomEvent(
      entry.isIntersecting ? 'exposure' : 'disexposure',
      {
        bubbles: true,
        composed: false,
        cancelable: false,
        detail,
      },
    );
    Object.assign(appearEvent, detail);
    this.#dom.dispatchEvent(appearEvent);
    this.#dom.dispatchEvent(exposureEvent);
  }

  #resizeObserving = false;
  #resizeObserver?: ResizeObserver;
  @registerEventEnableStatusChangeHandler('layoutchange')
  __handleScrollUpperThresholdEventEnabled = (enabled: boolean) => {
    if (enabled && this.#dom[layoutChangeTarget]) {
      if (!this.#resizeObserver) {
        this.#resizeObserver = new ResizeObserver(([entry]) => {
          if (entry) {
            // The layoutchange event is the border box of the element
            const { width, height, left, right, top, bottom } =
              entry.contentRect;
            const id = this.#dom.id;
            this.#dom.dispatchEvent(
              new CustomEvent('layoutchange', {
                detail: {
                  width,
                  height,
                  left,
                  right,
                  top,
                  bottom,
                  id,
                },
                ...commonComponentEventSetting,
              }),
            );
          }
        });
        if (!this.#resizeObserving) {
          this.#resizeObserver.observe(this.#dom[layoutChangeTarget]);
          this.#resizeObserving = true;
        }
      }
    } else {
      this.#resizeObserver?.disconnect();
    }
  };

  #disableExposure() {
    if (this.#exposureObserver) {
      this.#exposureObserver.disconnect();
      this.#exposureObserver = undefined;
    }
  }
}
