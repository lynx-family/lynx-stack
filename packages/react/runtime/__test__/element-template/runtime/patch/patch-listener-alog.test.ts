import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as elementTemplateAlog from '../../../../src/element-template/debug/alog.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { registerBuiltinRawTextTemplate } from '../../test-utils/debug/registry.js';

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

describe('ElementTemplate patch listener alog', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
    envManager.resetEnv('main');
    registerBuiltinRawTextTemplate();
    installElementTemplatePatchListener();
  });

  afterEach(() => {
    globalThis.__ALOG__ = true;
    resetElementTemplatePatchListener();
  });

  it('logs decoded update payloads before applying patches', () => {
    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();

    envManager.switchToBackground(() => {
      lynx.getCoreContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.update,
        data: {
          ops: createRawTextOps(1, 'hello'),
          flushOptions: { nativeUpdateDataOrder: 7 },
          flowIds: [101, 202],
        },
      });
    });
    envManager.switchToMainThread();

    const output = alog.mock.calls.map(args => String(args[0])).join('\n');
    expect(output).toContain('[ReactLynxDebug] ElementTemplate main-thread patch');
    expect(output).toContain('createTemplate');
    expect(output).toContain('nativeUpdateDataOrder');
    expect(output).toContain('101');
  });

  it('does not format patch alog when alog is disabled', () => {
    globalThis.__ALOG__ = false;
    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();
    const formatSpy = vi.spyOn(elementTemplateAlog, 'formatElementTemplateUpdateCommands');

    envManager.switchToBackground(() => {
      lynx.getCoreContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.update,
        data: {
          ops: createRawTextOps(1, 'hello'),
          flushOptions: { nativeUpdateDataOrder: 7 },
        },
      });
    });
    envManager.switchToMainThread();

    expect(formatSpy).not.toHaveBeenCalled();
    expect(alog.mock.calls).toHaveLength(0);
  });
});
