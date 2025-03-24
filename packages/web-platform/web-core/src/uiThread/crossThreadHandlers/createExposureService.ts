// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rpc } from '@lynx-js/web-worker-rpc';
import {
  lynxUniqueIdAttribute,
  type ExposureWorkerEvent,
  postExposureEndpoint,
  switchExposureService,
} from '@lynx-js/web-constants';
import { createCrossThreadEvent } from '../../utils/createCrossThreadEvent.js';

export function createExposureService(rpc: Rpc, shadowRoot: ShadowRoot) {
  let working = true;
  let exposureCache: ExposureWorkerEvent[] = [];
  let disexposureCache: ExposureWorkerEvent[] = [];
  const onScreen = new Map<string, ExposureWorkerEvent>();
  async function exposureEventHandler(ev: Event) {
    const exposureEvent = createCrossThreadEvent(ev) as ExposureWorkerEvent;
    exposureEvent.detail['unique-id'] = parseFloat(
      (ev.target as Element).getAttribute(lynxUniqueIdAttribute)!,
    );
    const exposureID = exposureEvent.exposureID;
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
      rpc.invoke(postExposureEndpoint, [{
        exposures: currentExposure,
        disExposures: currentDisexposure,
      }]);
    }
  }, 1000 / 20);
  shadowRoot.addEventListener('exposure', exposureEventHandler, {
    passive: true,
  });
  shadowRoot.addEventListener('disexposure', exposureEventHandler, {
    passive: true,
  });
  rpc.registerHandler(switchExposureService, async (enable, sendEvent) => {
    if (enable && !working) {
      // send all onScreen info
      rpc.invoke(postExposureEndpoint, [{
        exposures: [...onScreen.values()],
        disExposures: [],
      }]);
    } else if (!enable && working) {
      if (sendEvent) {
        rpc.invoke(postExposureEndpoint, [{
          exposures: [],
          disExposures: [...onScreen.values()],
        }]);
      }
    }
  });
}
