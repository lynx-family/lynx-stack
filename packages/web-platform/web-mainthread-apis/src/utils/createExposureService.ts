// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  lynxUniqueIdAttribute,
  type ExposureWorkerEvent,
} from '@lynx-js/web-constants';
import { createCrossThreadEvent } from './createCrossThreadEvent.js';
import type { MainThreadRuntime } from '../MainThreadRuntime.js';

export function createExposureService(runtime: MainThreadRuntime) {
  const postExposure = runtime.config.callbacks.postExposure;
  let working = true;
  let exposureCache: ExposureWorkerEvent[] = [];
  let disexposureCache: ExposureWorkerEvent[] = [];
  const onScreen = new Map<string, ExposureWorkerEvent>();
  function exposureEventHandler(ev: Event) {
    const exposureEvent = createCrossThreadEvent(
      runtime,
      ev,
      ev.type,
    ) as ExposureWorkerEvent;
    exposureEvent.detail['unique-id'] = parseFloat(
      (ev.target as Element).getAttribute(lynxUniqueIdAttribute)!,
    );
    const exposureID = exposureEvent.detail.exposureID;
    if (ev.type === 'exposure') {
      exposureCache.push(exposureEvent);
      onScreen.set(exposureID, exposureEvent);
    } else {
      disexposureCache.push(exposureEvent);
      onScreen.delete(exposureID);
    }
  }
  setInterval(() => {
    if (exposureCache.length > 0 || disexposureCache.length > 0) {
      const currentExposure = exposureCache;
      const currentDisexposure = disexposureCache;
      exposureCache = [];
      disexposureCache = [];
      postExposure({
        exposures: currentExposure,
        disExposures: currentDisexposure,
      });
    }
  }, 1000 / 20);
  runtime._rootDom.addEventListener('exposure', exposureEventHandler, {
    passive: true,
  });
  runtime._rootDom.addEventListener('disexposure', exposureEventHandler, {
    passive: true,
  });

  function switchExposureService(enable: boolean, sendEvent: boolean) {
    if (enable && !working) {
      // send all onScreen info
      postExposure({
        exposures: [...onScreen.values()],
        disExposures: [],
      });
    } else if (!enable && working) {
      if (sendEvent) {
        postExposure({
          exposures: [],
          disExposures: [...onScreen.values()],
        });
      }
    }
    working = enable;
  }
  return { switchExposureService };
}
