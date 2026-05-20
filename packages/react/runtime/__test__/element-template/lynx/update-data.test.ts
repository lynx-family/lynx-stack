import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeUpdateDataType } from '../../../src/core/lynx-update-data.js';
import { updateCardData } from '../../../src/element-template/lynx/update-data.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

type Listener = (...args: unknown[]) => void;

class LynxGlobalEventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  addListener(eventName: string, listener: Listener): void {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.add(listener);
      return;
    }
    this.listeners.set(eventName, new Set([listener]));
  }

  removeListener(eventName: string, listener: Listener): void {
    const listeners = this.listeners.get(eventName);
    listeners?.delete(listener);
  }

  emit(eventName: string, args?: unknown[]): void {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(...(args ?? []));
    }
  }
}

describe('ElementTemplate updateCardData', () => {
  const envManager = new ElementTemplateEnvManager();
  let originalLynx: typeof lynx;
  let emitter: LynxGlobalEventEmitter;
  let reportError: ReturnType<typeof vi.fn>;

  function installLynx(initData: Record<string, unknown>): void {
    const baseLynx = globalThis.lynx;
    vi.stubGlobal('lynx', {
      ...baseLynx,
      __initData: initData,
      reportError,
      getJSModule(moduleName: string) {
        if (moduleName === 'GlobalEventEmitter') {
          return emitter;
        }
        return baseLynx.getJSModule?.(moduleName);
      },
    });
  }

  beforeEach(() => {
    originalLynx = globalThis.lynx;
    emitter = new LynxGlobalEventEmitter();
    reportError = vi.fn();
    envManager.resetEnv('background');
  });

  afterEach(() => {
    vi.stubGlobal('lynx', originalLynx);
  });

  it('updates initData and emits restNewData through the ET listener channel', () => {
    installLynx({ msg: 'init', stable: true });
    const listener = vi.fn();
    emitter.addListener('onDataChanged', listener);

    updateCardData({ msg: 'update', next: 1 });

    expect(lynx.__initData).toEqual({ msg: 'update', stable: true, next: 1 });
    expect(listener).toHaveBeenCalledWith({ msg: 'update', next: 1 });
    expect(reportError).not.toHaveBeenCalled();
  });

  it('clears previous initData when RESET is requested', () => {
    installLynx({ stale: true, msg: 'init' });
    const listener = vi.fn();
    emitter.addListener('onDataChanged', listener);

    updateCardData(
      { msg: 'reset' },
      { type: NativeUpdateDataType.RESET },
    );

    expect(lynx.__initData).toEqual({ msg: 'reset' });
    expect(listener).toHaveBeenCalledWith({ msg: 'reset' });
  });

  it('reports and strips __lynx_timing_flag before emitting onDataChanged', () => {
    installLynx({ msg: 'init' });
    const listener = vi.fn();
    emitter.addListener('onDataChanged', listener);

    updateCardData({
      msg: 'update',
      __lynx_timing_flag: '__lynx_timing_actual_fmp',
    });

    expect(lynx.__initData).toEqual({ msg: 'update' });
    expect(listener).toHaveBeenCalledWith({ msg: 'update' });
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toBe(
      'Received unsupported updateData with `__lynx_timing_flag` (value "__lynx_timing_actual_fmp"), the timing flag is ignored',
    );
  });
});
