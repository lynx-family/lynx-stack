// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { buildBenchPlanShareUrl } from './benchPlanShare.js';
import type { BenchSharedPlan } from './benchPlanShare.js';
import { copyToClipboard } from '../../utils/clipboard.js';

export async function shareBenchPlan(
  plan: Omit<BenchSharedPlan, 'version'>,
  onNotice: (message: string) => void,
): Promise<void> {
  onNotice('');
  try {
    const url = buildBenchPlanShareUrl(window.location.href, plan);
    if (!await copyToClipboard(url)) {
      throw new Error('Could not copy the parameter link. Please try again.');
    }
    onNotice(`Parameter link copied for "${plan.title}".`);
  } catch (error) {
    onNotice(error instanceof Error ? error.message : String(error));
  }
}
