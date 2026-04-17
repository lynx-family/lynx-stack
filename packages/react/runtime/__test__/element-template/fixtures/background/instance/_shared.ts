import {
  GlobalCommitContext,
  resetGlobalCommitContext,
} from '../../../../../src/element-template/background/commit-context.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
} from '../../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../../src/element-template/background/manager.js';

export function runCase<T>(runner: () => T): T {
  backgroundElementTemplateInstanceManager.clear();
  backgroundElementTemplateInstanceManager.nextId = 0;
  resetGlobalCommitContext();
  (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];

  try {
    return runner();
  } finally {
    resetGlobalCommitContext();
  }
}

export {
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
  GlobalCommitContext,
  resetGlobalCommitContext,
};
