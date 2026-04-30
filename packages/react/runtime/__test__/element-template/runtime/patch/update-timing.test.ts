import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import { setPipeline } from '../../../../src/element-template/lynx/performance.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { registerBuiltinRawTextTemplate } from '../../test-utils/debug/registry.js';

const pipelineOptions = {
  pipelineID: 'pipelineID',
  needTimestamps: true,
} as const;

function createRawTextOps(id: number, text: string) {
  return [
    ElementTemplateUpdateOps.createTemplate,
    id,
    '__et_builtin_raw_text__',
    null,
    [text],
    [],
  ];
}

describe('ElementTemplate update timing (main thread patch)', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    envManager.resetEnv('main');
    registerBuiltinRawTextTemplate();
    installElementTemplatePatchListener();
    lynx.performance._markTiming.mockClear();
    (__FlushElementTree as unknown as { mockClear: () => void }).mockClear();
  });

  afterEach(() => {
    resetElementTemplatePatchListener();
    setPipeline(undefined);
  });

  it('marks parse/patch timings using pipeline options', () => {
    const payload = {
      ops: createRawTextOps(1, 'hello'),
      flushOptions: { pipelineOptions },
    };

    envManager.switchToBackground(() => {
      lynx.getCoreContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.update,
        data: payload,
      });
    });
    envManager.switchToMainThread();

    const flushCalls = (__FlushElementTree as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(flushCalls.length).toBeGreaterThan(0);
    expect(flushCalls[0]?.[1]).toMatchObject({ pipelineOptions });

    expect(lynx.performance._markTiming.mock.calls).toEqual([
      ['pipelineID', 'mtsRenderStart'],
      ['pipelineID', 'parseChangesStart'],
      ['pipelineID', 'parseChangesEnd'],
      ['pipelineID', 'patchChangesStart'],
      ['pipelineID', 'patchChangesEnd'],
      ['pipelineID', 'mtsRenderEnd'],
    ]);
  });

  it('handles updates without flush options', () => {
    const payload = {
      ops: createRawTextOps(1, 'hello'),
    };

    envManager.switchToBackground(() => {
      lynx.getCoreContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.update,
        data: payload,
      });
    });
    envManager.switchToMainThread();

    const flushCalls = (__FlushElementTree as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(flushCalls.length).toBeGreaterThan(0);
  });
});
