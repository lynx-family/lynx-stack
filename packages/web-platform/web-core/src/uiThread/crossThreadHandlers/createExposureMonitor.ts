// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { convertLengthToPx } from '../../utils/convertLengthToPx.js';
import {
  lynxUniqueIdAttribute,
  multiThreadExposureChangedEndpoint,
} from '@lynx-js/web-constants';

const scrollContainerDom = Symbol.for('lynx-scroll-container-dom');

export function createExposureMonitor(
  rootDom: ShadowRoot,
): {
  exposureChangedCallback(targets?: Element[]): void;
} {
  const intersectionObservers = new WeakMap<Element, IntersectionObserver>();
  const exposureIdOldValues = new WeakMap<Element, string | null>();
  const exposedElements = new WeakSet<Element>();
  const sendExposureEvent = (
    target: Element,
    isIntersecting: boolean,
    exposureId: string | null,
  ) => {
    const exposureScene = target.getAttribute('exposure-scene') ?? '';
    const detail = {
      exposureID: exposureId,
      exposureScene,
      'exposure-id': exposureId,
      'exposure-scene': exposureScene,
    };
    const appearEvent = new CustomEvent(
      isIntersecting ? 'uiappear' : 'uidisappear',
      {
        bubbles: false,
        composed: false,
        cancelable: true,
        detail,
      },
    );
    const exposureEvent = new CustomEvent(
      isIntersecting ? 'exposure' : 'disexposure',
      {
        bubbles: true,
        composed: false,
        cancelable: false,
        detail,
      },
    );
    Object.assign(appearEvent, detail);
    target.dispatchEvent(appearEvent);
    target.dispatchEvent(exposureEvent);
  };
  const intersectionObserverCallback = (
    entries: IntersectionObserverEntry[],
  ) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting && !exposedElements.has(target)) {
        sendExposureEvent(target, true, target.getAttribute('exposure-id'));
        exposedElements.add(target);
      } else if (!isIntersecting && exposedElements.has(target)) {
        sendExposureEvent(target, false, target.getAttribute('exposure-id'));
        exposedElements.delete(target);
      }
    });
  };
  const startIntersectionObserver = (target: HTMLElement) => {
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
    const rootContainer = root ?? rootDom.parentElement!;
    const intersectionObserver = new IntersectionObserver(
      intersectionObserverCallback,
      {
        rootMargin:
          `${calcedRootMarginTop}px ${calcedRootMarginRight}px ${calcedRootMarginBottom}px ${calcedRootMarginLeft}px`,
        root: rootContainer,
        threshold,
      },
    );
    intersectionObserver.observe(target);
    intersectionObservers.set(target, intersectionObserver);
  };
  const exposureChangedCallback = (targets: HTMLElement[]) => {
    targets.forEach((target) => {
      const exposureIdOldValue = exposureIdOldValues.get(target) ?? null;
      const exposureIdNewValue = target.getAttribute('exposure-id');
      if (exposureIdOldValue !== null) {
        sendExposureEvent(target, false, exposureIdOldValue);
      }
      exposureIdOldValues.set(target, exposureIdNewValue);
      intersectionObservers.get(target)?.disconnect();
      intersectionObservers.delete(target);
      exposedElements.delete(target);
      if (target.getAttribute('exposure-id') !== null) {
        startIntersectionObserver(target);
      }
    });
  };
  return {
    exposureChangedCallback,
  };
}

export function createExposureMonitorForMultiThread(
  rpc: Rpc,
  rootDom: ShadowRoot,
): void {
  const { exposureChangedCallback } = createExposureMonitor(rootDom);
  rpc.registerHandler(multiThreadExposureChangedEndpoint, (uniqueIds) => {
    exposureChangedCallback(
      uniqueIds.map(id =>
        rootDom.querySelector(`[${lynxUniqueIdAttribute}="${id}"]`)
      ).filter(el => el !== null) as Element[],
    );
  });
}
