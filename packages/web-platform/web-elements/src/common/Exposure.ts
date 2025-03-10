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

  #uiAppearEnabled = false;
  #uiDisappearEnabled = false;

  readonly #currentElement: HTMLElement;

  /**
   * Stores a promise. We will handler the exposure attribute change after all related life-cycle events has been fired by browser.
   */
  #afterAttributeChanged?: Promise<void>;

  /**
   * If this dom is already exposured
   */
  #exposureTriggerd = false;

  /**
   * keeps the observer of current dom
   */
  #exposureObserver?: IntersectionObserver;

  get #exposureEnabled() {
    return (
      this.#uiAppearEnabled
      || this.#uiDisappearEnabled
      || this.#currentElement.getAttribute('exposure-id') !== null
    );
  }

  constructor(currentElement: HTMLElement) {
    this.#currentElement = currentElement;
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
      exposureID: this.#currentElement.getAttribute('exposure-id'),
      exposureArea: this.#currentElement.getAttribute('exposure-area'),
      exposureScene: this.#currentElement.getAttribute('exposure-scene'),
      exposureScreenMarginTop: this.#currentElement.getAttribute(
        'exposure-screen-margin-top',
      ),
      exposureScreenMarginRight: this.#currentElement.getAttribute(
        'exposure-screen-margin-right',
      ),
      exposureScreenMarginBottom: this.#currentElement.getAttribute(
        'exposure-screen-margin-bottom',
      ),
      exposureScreenMarginLeft: this.#currentElement.getAttribute(
        'exposure-screen-margin-left',
      ),
      exposureUIMarginTop: this.#currentElement.getAttribute(
        'exposure-ui-margin-top',
      ),
      exposureUIMarginRight: this.#currentElement.getAttribute(
        'exposure-ui-margin-right',
      ),
      exposureUIMarginBottom: this.#currentElement.getAttribute(
        'exposure-ui-margin-bottom',
      ),
      exposureUIMarginLeft: this.#currentElement.getAttribute(
        'exposure-ui-margin-left',
      ),
    };
    if (this.#exposureEnabled) {
      if (IntersectionObserver) {
        const uiMargin = {
          top: convertLengthToPx(
            this.#currentElement,
            newParams.exposureUIMarginTop,
          ),
          right: convertLengthToPx(
            this.#currentElement,
            newParams.exposureUIMarginRight,
            true,
          ),
          bottom: convertLengthToPx(
            this.#currentElement,
            newParams.exposureUIMarginBottom,
          ),
          left: convertLengthToPx(
            this.#currentElement,
            newParams.exposureUIMarginLeft,
            true,
          ),
        };
        const screenMargin = {
          top: convertLengthToPx(
            this.#currentElement,
            newParams.exposureScreenMarginTop,
          ),
          right: convertLengthToPx(
            this.#currentElement,
            newParams.exposureScreenMarginRight,
            true,
          ),
          bottom: convertLengthToPx(
            this.#currentElement,
            newParams.exposureScreenMarginBottom,
          ),
          left: convertLengthToPx(
            this.#currentElement,
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
        const exposureArea = this.#currentElement.getAttribute('exposure-area');
        const rootMargin =
          `${calcedRootMargin.top}px ${calcedRootMargin.right}px ${calcedRootMargin.bottom}px ${calcedRootMargin.left}px`;
        const threshold = exposureArea ? parseFloat(exposureArea) / 100 : 0;
        if (this.#exposureObserver) {
          this.#exposureObserver.disconnect();
        }

        /**
         * Get the closest scrollable ancestor
         */
        let root: HTMLElement | null = this.#currentElement.parentElement;
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
        this.#exposureTriggerd = false;
        this.#exposureObserver = new IntersectionObserver(
          ([entry]) => {
            if (entry) {
              if (entry.isIntersecting) {
                this.#exposureTriggerd = true;
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
        this.#exposureObserver.observe(this.#currentElement);
      }
    } else {
      this.disableExposure();
    }
  }

  #sendOneExposureEvent(
    entry: IntersectionObserverEntry | { isIntersecting: boolean },
    overrideExposureId?: string,
  ) {
    if (!this.#exposureTriggerd) {
      return;
    }
    const exposureID = overrideExposureId
      ?? this.#currentElement.getAttribute('exposure-id') ?? '';
    const exposureScene = this.#currentElement.getAttribute('exposure-scene')
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
    this.#currentElement.dispatchEvent(appearEvent);
    this.#currentElement.dispatchEvent(exposureEvent);
  }

  public disableExposure() {
    if (this.#exposureObserver) {
      this.#exposureObserver.disconnect();
      this.#exposureObserver = undefined;
    }
  }
}
