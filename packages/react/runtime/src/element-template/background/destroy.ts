// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ContainerNode } from 'preact';
import { render } from 'preact';

import { cancelElementTemplateRemovedSubtreeCleanup, resetElementTemplateCommitState } from './commit-hook.js';
import { resetElementTemplateHydrationListener } from './hydration-listener.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { clearEventState } from '../prop-adapters/event.js';
import { clearRefState, flushPendingRefs } from '../prop-adapters/ref.js';
import { __root } from '../runtime/page/root-instance.js';

export function destroyElementTemplateBackgroundRuntime(): void {
  resetElementTemplateHydrationListener();
  cancelElementTemplateRemovedSubtreeCleanup();

  render(null, __root as unknown as ContainerNode);
  // Run user cleanup before dropping the backend side tables; after clearRefState
  // the raw ref ownership needed to detach callbacks is gone.
  flushPendingRefs();

  resetElementTemplateCommitState();
  clearEventState();
  clearRefState();
  backgroundElementTemplateInstanceManager.clear();
}
