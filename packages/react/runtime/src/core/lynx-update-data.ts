// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BTSUpdateOptions } from '@lynx-js/lynx-runtime';

import { RESET_WITH_INIT_DATA_IN_STATE_ERROR, hasWithInitDataInStateUsage } from './initData.js';

let hasReportedResetWithInitDataInState = false;

type InitDataPatch = Record<string, any>;

export function updateCardData(
  newData: InitDataPatch,
  options: Readonly<BTSUpdateOptions>,
): void {
  const { ['__lynx_timing_flag']: performanceTimingFlag, ...restNewData } = newData;
  if (performanceTimingFlag) {
    lynx.reportError(
      new Error(
        `Received unsupported updateData with \`__lynx_timing_flag\` (value "${performanceTimingFlag}"), the timing flag is ignored`,
      ),
    );
  }

  if (options.resetPageData) {
    if (__DEV__ && !hasReportedResetWithInitDataInState && hasWithInitDataInStateUsage()) {
      hasReportedResetWithInitDataInState = true;
      lynx.reportError(new Error(RESET_WITH_INIT_DATA_IN_STATE_ERROR));
    }
    lynx.__initData = {};
  }

  // COW keeps provider/consumer readers aligned with Snapshot updateData behavior.
  lynx.__initData = Object.assign({}, lynx.__initData, restNewData);

  lynx.getJSModule('GlobalEventEmitter').emit('onDataChanged', [restNewData]);
}
