// Note: This file will be inlined into `content-script.ts`
// when building the extension.

import { createHook } from '../../adapter/hook';
import { createPortForHook } from '../../adapter/adapter/port';

(globalThis as any).__PREACT_DEVTOOLS__ = createHook(
  createPortForHook(preactDevtoolsCtx),
);
