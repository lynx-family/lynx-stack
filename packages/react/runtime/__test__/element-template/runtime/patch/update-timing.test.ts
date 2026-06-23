import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';

import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import { setPipeline } from '../../../../src/core/performance.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import {
  createElementTemplateUpdateEvent,
  type ElementTemplateUpdateEvent,
} from '../../../../src/element-template/protocol/update-event.js';
import { getReloadVersion, increaseReloadVersion } from '../../../../src/core/reload-version.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { BUILTIN_RAW_TEXT_TEMPLATE_ID, registerBuiltinRawTextTemplate } from '../../test-utils/debug/registry.js';

const pipelineOptions = {
  pipelineID: 'pipelineID',
  needTimestamps: true,
} as const;

function createRawTextOps(id: number, text: string) {
  return [
    ElementTemplateUpdateOps.createTemplate,
    id,
    BUILTIN_RAW_TEXT_TEMPLATE_ID,
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
    (lynx.performance.profileStart as unknown as { mockClear: () => void }).mockClear();
    (lynx.performance.profileEnd as unknown as { mockClear: () => void }).mockClear();
    (__FlushElementTree as unknown as { mockClear: () => void }).mockClear();
  });

  afterEach(() => {
    resetElementTemplatePatchListener();
    setPipeline(undefined);
  });

  it('marks parse/patch timings using pipeline options', () => {
    const flowIds = [101, 202];
    const payload = {
      ops: createRawTextOps(1, 'hello'),
      flushOptions: { pipelineOptions },
      flowIds,
      reloadVersion: getReloadVersion(),
    };
    let didParseData = false;
    const serializedPayload = {
      toString() {
        didParseData = true;
        expect(lynx.performance._markTiming.mock.calls).toEqual([
          ['pipelineID', 'mtsRenderStart'],
          ['pipelineID', 'parseChangesStart'],
        ]);
        return JSON.stringify(payload);
      },
    } as unknown as string;
    const updateEvent: ElementTemplateUpdateEvent = {
      type: ElementTemplateLifecycleConstant.update,
      data: {
        payload: serializedPayload,
        patchOptions: {
          pipelineOptions,
          reloadVersion: getReloadVersion(),
          flowIds,
        },
      },
    };

    envManager.switchToBackground(() => {
      lynx.getCoreContext().dispatchEvent(updateEvent);
    });
    envManager.switchToMainThread();

    expect(didParseData).toBe(true);
    const flushCalls = (__FlushElementTree as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(flushCalls.length).toBeGreaterThan(0);
    expect(flushCalls[0]?.[1]).toMatchObject({ pipelineOptions });
    expect(lynx.performance.profileStart).toHaveBeenCalledWith('ReactLynx::patch', {
      flowId: flowIds[0],
      flowIds,
    });
    expect(lynx.performance.profileEnd).toHaveBeenCalledTimes(1);

    expect(lynx.performance._markTiming.mock.calls).toEqual([
      ['pipelineID', 'mtsRenderStart'],
      ['pipelineID', 'parseChangesStart'],
      ['pipelineID', 'parseChangesEnd'],
      ['pipelineID', 'patchChangesStart'],
      ['pipelineID', 'patchChangesEnd'],
      ['pipelineID', 'mtsRenderEnd'],
    ]);
  });

  it('handles updates without pipeline options', () => {
    const payload = {
      ops: createRawTextOps(1, 'hello'),
      flushOptions: {},
      reloadVersion: getReloadVersion(),
    };

    envManager.switchToBackground(() => {
      lynx.getCoreContext().dispatchEvent(createElementTemplateUpdateEvent(payload));
    });
    envManager.switchToMainThread();

    const flushCalls = (__FlushElementTree as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(flushCalls.length).toBeGreaterThan(0);
  });

  it('ignores update payloads from an older reload version', () => {
    const staleReloadVersion = getReloadVersion();
    increaseReloadVersion();
    const payload = {
      ops: createRawTextOps(1, 'stale'),
      flushOptions: { pipelineOptions },
      reloadVersion: staleReloadVersion,
    };

    envManager.switchToBackground(() => {
      lynx.getCoreContext().dispatchEvent(createElementTemplateUpdateEvent(payload));
    });
    envManager.switchToMainThread();

    const flushCalls = (__FlushElementTree as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(flushCalls).toHaveLength(0);
    expect(lynx.performance._markTiming.mock.calls).toEqual([]);
  });

  it('marks parse timing for empty update envelopes with pipeline options', () => {
    const payload = {
      ops: [],
      flushOptions: { pipelineOptions },
      reloadVersion: getReloadVersion(),
    };

    envManager.switchToBackground(() => {
      lynx.getCoreContext().dispatchEvent(createElementTemplateUpdateEvent(payload));
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
      ['pipelineID', 'mtsRenderEnd'],
    ]);
  });

  it('accepts update payloads from the current reload version', () => {
    increaseReloadVersion();
    const payload = {
      ops: createRawTextOps(1, 'fresh'),
      flushOptions: { pipelineOptions },
      reloadVersion: getReloadVersion(),
    };

    envManager.switchToBackground(() => {
      lynx.getCoreContext().dispatchEvent(createElementTemplateUpdateEvent(payload));
    });
    envManager.switchToMainThread();

    const flushCalls = (__FlushElementTree as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(flushCalls.length).toBeGreaterThan(0);
    expect(flushCalls[0]?.[1]).toMatchObject({ pipelineOptions });
  });
});
