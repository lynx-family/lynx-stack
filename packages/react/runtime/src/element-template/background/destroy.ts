// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cancelElementTemplateRemovedSubtreeCleanup, resetElementTemplateCommitState } from './commit-hook.js';
import { resetElementTemplateHydrationListener } from './hydration-listener.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { clearEventState } from '../prop-adapters/event.js';

export function destroyElementTemplateBackgroundRuntime(): void {
  resetElementTemplateHydrationListener();
  resetElementTemplateCommitState();
  // Destroy is the only place that may discard delayed removed subtrees instead
  // of letting the Snapshot-aligned timer tear them down later.
  cancelElementTemplateRemovedSubtreeCleanup();
  clearEventState();
  backgroundElementTemplateInstanceManager.clear();
}
