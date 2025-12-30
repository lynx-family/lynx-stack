/*
 * Copyright 2021-2024 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  CloneableObject,
  DecoratedHTMLElement,
  ExposureEventDetail,
  GlobalExposureEvent,
} from '../../types/index.js';
import { scrollContainerDom } from '../../constants.js';
import { convertLengthToPx } from './utils/convertLengthToPx.js';
import type { LynxViewInstance } from './LynxViewInstance.js';

export class ExposureServices {
  #exposureEnabledElementsToIntersectionObserver: Map<
    HTMLElement,
    IntersectionObserver
  > = new Map();
  #exposureEnabledElementsToOldExposureIdAttributeValue: Map<
    HTMLElement,
    string
  > = new Map();
  #globalExposureEventCache: GlobalExposureEvent[] = [];
  #globalDisexposureEventCache: GlobalExposureEvent[] = [];
  #globalExposureEventBatchTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * The elements that are currently exposed
   * We only send the event when the element enters or leaves the exposed state
   */
  #exposedElements: Set<Element> = new Set();
  /**
   * note that this flag only affects the global exposure events.
   * The uiappear/uidisappear events are always dispatched when the element enters or leaves the viewport
   */
  #isExposureServiceOn: boolean = true;
  readonly #lynxViewInstance: LynxViewInstance;

  constructor(
    lynxViewInstance: LynxViewInstance,
  ) {
    this.#lynxViewInstance = lynxViewInstance;
  }

  /**
   * diff the current exposure enabled elements with the previous ones, and start/stop IntersectionObserver accordingly
   * If an element's exposure-id attribute has changed, we also need to send a new disexposure event with the old one
   */
  updateExposureStatus(
    elementsToBeEnabled: HTMLElement[],
  ) {
    const elementsToBeEnabledSet = new Set(elementsToBeEnabled);
    for (
      const element of this.#exposureEnabledElementsToIntersectionObserver
        .keys()
    ) {
      if (!elementsToBeEnabledSet.has(element)) {
        // stop observing elements that are no longer enabled
        this.#exposureEnabledElementsToIntersectionObserver.get(element)
          ?.disconnect();
        this.#exposureEnabledElementsToIntersectionObserver.delete(element);
        this.#exposureEnabledElementsToOldExposureIdAttributeValue.delete(
          element,
        );
      }
    }
    // start observing newly enabled elements
    elementsToBeEnabledSet.forEach((element) => {
      const currentExposureId = element.getAttribute('exposure-id') || '';
      if (!this.#exposureEnabledElementsToIntersectionObserver.has(element)) {
        this.#exposureEnabledElementsToIntersectionObserver.get(element)
          ?.disconnect();
        this.#exposureEnabledElementsToOldExposureIdAttributeValue.set(
          element,
          currentExposureId,
        );
        this.#startIntersectionObserver(element);
      } else {
        // check if exposure-id attribute has changed
        const oldExposureId = this
          .#exposureEnabledElementsToOldExposureIdAttributeValue.get(element);
        if (oldExposureId !== currentExposureId) {
          this.#exposureEnabledElementsToOldExposureIdAttributeValue.set(
            element,
            currentExposureId,
          );
          if (oldExposureId != null) {
            // send disexposure event with old exposure id
            this.#sendExposureEvent(element, false, oldExposureId, false);
          }
        }
      }
    });
  }

  #IntersectionObserverEventHandler = (
    entries: IntersectionObserverEntry[],
  ) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting && !this.#exposedElements.has(target as HTMLElement)) {
        this.#sendExposureEvent(target as HTMLElement, true, null, true);
        this.#exposedElements.add(target as HTMLElement);
      } else if (
        !isIntersecting && this.#exposedElements.has(target as HTMLElement)
      ) {
        this.#sendExposureEvent(target as HTMLElement, false, null, true);
        this.#exposedElements.delete(target as HTMLElement);
      }
    });
  };

  #startIntersectionObserver(target: HTMLElement) {
    const threshold = parseFloat(target.getAttribute('exposure-area') ?? '0')
      / 100;
    const screenMarginTop = convertLengthToPx(
      target,
      target.getAttribute('exposure-screen-margin-top'),
    );
    const screenMarginRight = convertLengthToPx(
      target,
      target.getAttribute('exposure-screen-margin-right'),
    );
    const screenMarginBottom = convertLengthToPx(
      target,
      target.getAttribute('exposure-screen-margin-bottom'),
    );
    const screenMarginLeft = convertLengthToPx(
      target,
      target.getAttribute('exposure-screen-margin-left'),
    );
    const uiMarginTop = convertLengthToPx(
      target,
      target.getAttribute('exposure-ui-margin-top'),
    );
    const uiMarginRight = convertLengthToPx(
      target,
      target.getAttribute('exposure-ui-margin-right'),
    );
    const uiMarginBottom = convertLengthToPx(
      target,
      target.getAttribute('exposure-ui-margin-bottom'),
    );
    const uiMarginLeft = convertLengthToPx(
      target,
      target.getAttribute('exposure-ui-margin-left'),
    );
    /**
     * TODO: @haoyang.wang support the switch `enableExposureUIMargin`
     */
    const calcedRootMarginTop = (uiMarginBottom ? -1 : 1)
      * (screenMarginTop - uiMarginBottom);
    const calcedRootMarginRight = (uiMarginLeft ? -1 : 1)
      * (screenMarginRight - uiMarginLeft);
    const calcedRootMarginBottom = (uiMarginTop ? -1 : 1)
      * (screenMarginBottom - uiMarginTop);
    const calcedRootMarginLeft = (uiMarginRight ? -1 : 1)
      * (screenMarginLeft - uiMarginRight);
    // get the parent scroll container
    let root: HTMLElement | null = target.parentElement;
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
    const rootContainer = root ?? this.#lynxViewInstance.rootDom.parentElement!;
    const intersectionObserver = new IntersectionObserver(
      this.#IntersectionObserverEventHandler,
      {
        rootMargin:
          `${calcedRootMarginTop}px ${calcedRootMarginRight}px ${calcedRootMarginBottom}px ${calcedRootMarginLeft}px`,
        root: rootContainer,
        threshold,
      },
    );
    intersectionObserver.observe(target);
    this.#exposureEnabledElementsToIntersectionObserver.set(
      target,
      intersectionObserver,
    );
  }

  #sendExposureEvent(
    target: HTMLElement,
    isIntersecting: boolean,
    exposureId: string | null,
    /**
     * Whether to send the uiappear/uidisappear event
     * If the exposure service is turned from off to on, we may not want to send the appear events for all currently exposed elements
     */
    sendAppearEvent: boolean,
  ) {
    exposureId = exposureId ?? target.getAttribute('exposure-id')!;
    const exposureScene = target.getAttribute('exposure-scene') ?? '';
    const uniqueId = this.#lynxViewInstance.mainThreadGlobalThis
      .__GetElementUniqueID(target);
    const detail: ExposureEventDetail = {
      'unique-id': uniqueId,
      exposureID: exposureId,
      exposureScene,
      'exposure-id': exposureId,
      'exposure-scene': exposureScene,
    };
    if (sendAppearEvent) {
      const appearEvent = new CustomEvent(
        isIntersecting ? 'uiappear' : 'uidisappear',
        {
          bubbles: false,
          composed: false,
          cancelable: true,
          detail,
        },
      );
      target.dispatchEvent(appearEvent);
    }
    const serializedTargetInfo = this.#lynxViewInstance.mtsWasmBinding
      .generateTargetObject(
        target as DecoratedHTMLElement,
        this.#lynxViewInstance.mainThreadGlobalThis.__GetDataset(
          target,
        ) as CloneableObject
          ?? ({} as CloneableObject),
      );
    const globalEvent: GlobalExposureEvent = {
      ...serializedTargetInfo.dataset,
      ...detail,
      type: isIntersecting ? 'exposure' : 'disexposure',
      target: serializedTargetInfo,
      currentTarget: serializedTargetInfo,
      detail: {
        ...detail,
        'unique-id': 0,
      },
      timestamp: Date.now(),
    };
    if (isIntersecting) {
      this.#globalExposureEventCache.push(globalEvent);
    } else {
      this.#globalDisexposureEventCache.push(globalEvent);
    }
    if (!this.#globalExposureEventBatchTimer) {
      this.#globalExposureEventBatchTimer = setTimeout(() => {
        if (
          this.#globalExposureEventCache.length > 0
          || this.#globalDisexposureEventCache.length > 0
        ) {
          const currentExposureEvents = this.#globalExposureEventCache;
          const currentDisexposureEvents = this.#globalDisexposureEventCache;
          this.#globalExposureEventCache = [];
          this.#globalDisexposureEventCache = [];
          this.#lynxViewInstance.backgroundThread?.sendGlobalEvent('exposure', [
            currentExposureEvents,
          ]);
          this.#lynxViewInstance.backgroundThread?.sendGlobalEvent(
            'disexposure',
            [
              currentDisexposureEvents,
            ],
          );
        }
        this.#globalExposureEventBatchTimer = null;
      }, 1000 / 20);
    }
  }

  switchExposureService(toEnable: boolean, sendEvent: boolean) {
    if (toEnable && !this.#isExposureServiceOn) {
      // send all onScreen info
      this.#exposedElements.forEach((element) => {
        this.#sendExposureEvent(
          element as HTMLElement,
          true,
          element.getAttribute('exposure-id'),
          false,
        );
      });
    } else if (!toEnable && this.#isExposureServiceOn) {
      if (sendEvent) {
        this.#exposedElements.forEach((element) => {
          this.#sendExposureEvent(
            element as HTMLElement,
            false,
            element.getAttribute('exposure-id'),
            false,
          );
        });
      }
    }
    this.#isExposureServiceOn = toEnable;
  }
}
