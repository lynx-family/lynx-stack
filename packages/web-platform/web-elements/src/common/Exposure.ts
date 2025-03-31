// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { convertLengthToPx } from './convertLengthToPx.js';
import { commonComponentEventSetting } from './commonEventInitConfiguration.js';
import { scrollContainerDom } from './constants.js';

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

export class LynxExposure {
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

  __uiAppearEnabled = false;
  __uiDisappearEnabled = false;

  readonly __currentElement: HTMLElement;

  /**
   * Stores a promise. We will handler the exposure attribute change after all related life-cycle events has been fired by browser.
   */
  __afterAttributeChanged?: Promise<void>;

  /**
   * If this dom is already exposured
   */
  __exposureTriggerd = false;

  /**
   * keeps the observer of current dom
   */
  __exposureObserver?: IntersectionObserver;

  get __exposureEnabled() {
    return (
      this.__uiAppearEnabled
      || this.__uiDisappearEnabled
      || this.__currentElement.getAttribute('exposure-id') !== null
    );
  }

  constructor(currentElement: HTMLElement) {
    this.__currentElement = currentElement;
  }

  onExposureParamsChanged = () => {
    if (!this.__afterAttributeChanged) {
      this.__afterAttributeChanged = Promise.resolve().then(() => {
        this.__updateExposure();
        this.__afterAttributeChanged = undefined;
      });
    }
  };

  onExposureIdChanged(_: string | null, oldValue: string | null) {
    if (oldValue) {
      if (this.__exposureEnabled) {
        this.__sendOneExposureEvent({ isIntersecting: false }, oldValue);
      }
    }
    this.onExposureParamsChanged();
  }
  attributeChangedHandler = new Proxy(this, {
    get(target, attribute: string) {
      if (LynxExposure.observedAttributes.includes(attribute)) {
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
      this.__uiAppearEnabled = status;
      this.onExposureParamsChanged();
    },
    'uidisappear': (status: boolean) => {
      this.__uiDisappearEnabled = status;
      this.onExposureParamsChanged();
    },
  };

  __updateExposure() {
    const newParams: ExposureParameters = {
      exposureID: this.__currentElement.getAttribute('exposure-id'),
      exposureArea: this.__currentElement.getAttribute('exposure-area'),
      exposureScene: this.__currentElement.getAttribute('exposure-scene'),
      exposureScreenMarginTop: this.__currentElement.getAttribute(
        'exposure-screen-margin-top',
      ),
      exposureScreenMarginRight: this.__currentElement.getAttribute(
        'exposure-screen-margin-right',
      ),
      exposureScreenMarginBottom: this.__currentElement.getAttribute(
        'exposure-screen-margin-bottom',
      ),
      exposureScreenMarginLeft: this.__currentElement.getAttribute(
        'exposure-screen-margin-left',
      ),
      exposureUIMarginTop: this.__currentElement.getAttribute(
        'exposure-ui-margin-top',
      ),
      exposureUIMarginRight: this.__currentElement.getAttribute(
        'exposure-ui-margin-right',
      ),
      exposureUIMarginBottom: this.__currentElement.getAttribute(
        'exposure-ui-margin-bottom',
      ),
      exposureUIMarginLeft: this.__currentElement.getAttribute(
        'exposure-ui-margin-left',
      ),
    };
    if (this.__exposureEnabled) {
      if (IntersectionObserver) {
        const uiMargin = {
          top: convertLengthToPx(
            this.__currentElement,
            newParams.exposureUIMarginTop,
          ),
          right: convertLengthToPx(
            this.__currentElement,
            newParams.exposureUIMarginRight,
            true,
          ),
          bottom: convertLengthToPx(
            this.__currentElement,
            newParams.exposureUIMarginBottom,
          ),
          left: convertLengthToPx(
            this.__currentElement,
            newParams.exposureUIMarginLeft,
            true,
          ),
        };
        const screenMargin = {
          top: convertLengthToPx(
            this.__currentElement,
            newParams.exposureScreenMarginTop,
          ),
          right: convertLengthToPx(
            this.__currentElement,
            newParams.exposureScreenMarginRight,
            true,
          ),
          bottom: convertLengthToPx(
            this.__currentElement,
            newParams.exposureScreenMarginBottom,
          ),
          left: convertLengthToPx(
            this.__currentElement,
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
        const exposureArea = this.__currentElement.getAttribute(
          'exposure-area',
        );
        const rootMargin =
          `${calcedRootMargin.top}px ${calcedRootMargin.right}px ${calcedRootMargin.bottom}px ${calcedRootMargin.left}px`;
        const threshold = exposureArea ? parseFloat(exposureArea) / 100 : 0;
        if (this.__exposureObserver) {
          this.__exposureObserver.disconnect();
        }

        /**
         * Get the closest scrollable ancestor
         */
        let root: HTMLElement | null = this.__currentElement.parentElement;
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
        this.__exposureTriggerd = false;
        this.__exposureObserver = new IntersectionObserver(
          ([entry]) => {
            if (entry) {
              if (entry.isIntersecting) {
                this.__exposureTriggerd = true;
              }
              this.__sendOneExposureEvent(entry);
            }
          },
          {
            rootMargin,
            threshold,
            root,
          },
        );
        this.__exposureObserver.observe(this.__currentElement);
      }
    } else {
      this.disableExposure();
    }
  }

  __sendOneExposureEvent(
    entry: IntersectionObserverEntry | { isIntersecting: boolean },
    overrideExposureId?: string,
  ) {
    if (!this.__exposureTriggerd) {
      return;
    }
    const exposureID = overrideExposureId
      ?? this.__currentElement.getAttribute('exposure-id') ?? '';
    const exposureScene = this.__currentElement.getAttribute('exposure-scene')
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
    this.__currentElement.dispatchEvent(appearEvent);
    this.__currentElement.dispatchEvent(exposureEvent);
  }

  public disableExposure() {
    if (this.__exposureObserver) {
      this.__exposureObserver.disconnect();
      this.__exposureObserver = undefined;
    }
  }
}
