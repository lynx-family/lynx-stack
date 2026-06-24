// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { RESET_WITH_INIT_DATA_IN_STATE_ERROR, hasWithInitDataInStateUsage } from './initData.js';
import { isEmptyObject } from '../utils.js';

let hasReportedResetWithInitDataInState = false;

export function applyUpdatePageData(data: unknown, options?: Pick<UpdatePageOption, 'resetPageData'>): void {
  if (options?.resetPageData) {
    if (__DEV__ && !hasReportedResetWithInitDataInState && hasWithInitDataInStateUsage()) {
      hasReportedResetWithInitDataInState = true;
      lynx.reportError(new Error(RESET_WITH_INIT_DATA_IN_STATE_ERROR));
    }
    lynx.__initData = {};
  }

  if (typeof data == 'object' && data !== null && !isEmptyObject(data)) {
    lynx.__initData ??= {};
    Object.assign(lynx.__initData, data);
  }
}
