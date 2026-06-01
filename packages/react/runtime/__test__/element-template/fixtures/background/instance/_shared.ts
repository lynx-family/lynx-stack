import {
  globalCommitContext,
  resetGlobalCommitContext,
} from '../../../../../src/element-template/background/commit-context.js';
import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../../src/element-template/background/commit-hook.js';
import { BackgroundElementTemplateInstance } from '../../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../../src/element-template/background/manager.js';

export function runCase<T>(runner: () => T): T {
  backgroundElementTemplateInstanceManager.clear();
  backgroundElementTemplateInstanceManager.nextId = 0;
  resetElementTemplateCommitState();
  (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];

  try {
    return runner();
  } finally {
    resetElementTemplateCommitState();
  }
}

export {
  BackgroundElementTemplateInstance,
  globalCommitContext,
  markElementTemplateHydrated,
  resetGlobalCommitContext,
};
