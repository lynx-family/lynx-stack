// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { postExposureEndpoint } from '@client/endpoints.js';
import type { NativeTTObject } from '@types';

export function registerGlobalExposureEventHandler(
  rpc: Rpc,
  tt: NativeTTObject,
): void {
  rpc.registerHandler(postExposureEndpoint, ({ exposures, disExposures }) => {
    if (exposures.length > 0) {
      tt.GlobalEventEmitter.emit('exposure', [
        exposures.map(e =>
          Object.assign(e, e.detail, { dataset: e.target.dataset })
        ),
      ]);
    }
    if (disExposures.length > 0) {
      tt.GlobalEventEmitter.emit('disexposure', [
        disExposures.map(e =>
          Object.assign(e, e.detail, { dataset: e.target.dataset })
        ),
      ]);
    }
  });
}
