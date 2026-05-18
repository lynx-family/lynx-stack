import { EventEmitter } from 'node:events';

import { Component } from 'preact';
import type { ComponentClass } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  globalCommitContext,
  resetGlobalCommitContext,
} from '../../../../src/element-template/background/commit-context.js';
import {
  InitDataConsumer,
  InitDataProvider,
  useInitData,
  useInitDataChanged,
  withInitDataInState,
  root,
} from '../../../../src/element-template/index.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

declare const renderPage: (data?: Record<string, unknown>) => void;

function waitForRender(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('ElementTemplate InitData read API', () => {
  const envManager = new ElementTemplateEnvManager();
  let emitter: EventEmitter;
  let originalLynx: typeof lynx;

  function installInitData(initData: Record<string, unknown>): void {
    const baseLynx = globalThis.lynx;
    vi.stubGlobal('lynx', {
      ...baseLynx,
      __initData: initData,
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
    emitter = new EventEmitter();
    resetGlobalCommitContext();
  });

  afterEach(() => {
    envManager.switchToBackground();
    root.render(null);
    resetGlobalCommitContext();
    vi.stubGlobal('lynx', originalLynx);
  });

  it('reads initial data on the main thread', () => {
    envManager.resetEnv('main');
    installInitData({ msg: 'main' });
    let observed: unknown;

    function App() {
      observed = useInitData();
      return <view />;
    }

    root.render(<App />);
    renderPage({ msg: 'main' });

    expect(observed).toEqual({ msg: 'main' });
    expect(emitter.listenerCount('onDataChanged')).toBe(0);
  });

  it('provides full initData and marks data-updated on Provider changes', async () => {
    envManager.resetEnv('background');
    installInitData({ msg: 'init' });
    let consumed: unknown;

    function App() {
      return (
        <InitDataProvider>
          <InitDataConsumer>
            {(data) => {
              consumed = data;
              return <view />;
            }}
          </InitDataConsumer>
        </InitDataProvider>
      );
    }

    root.render(<App />);
    expect(consumed).toEqual({ msg: 'init' });

    lynx.__initData = { msg: 'update' };
    emitter.emit('onDataChanged', { msg: 'update' });
    await waitForRender();

    expect(consumed).toEqual({ msg: 'update' });
    expect(globalCommitContext.flushOptions.triggerDataUpdated).toBe(true);
  });

  it('keeps useInitDataChanged listener-only', () => {
    envManager.resetEnv('background');
    installInitData({ msg: 'init' });
    const callback = vi.fn();

    function App() {
      useInitDataChanged(callback);
      return <view />;
    }

    root.render(<App />);
    emitter.emit('onDataChanged', { patch: true });

    expect(callback).toHaveBeenCalledWith({ patch: true });
    expect(globalCommitContext.flushOptions.triggerDataUpdated).toBeUndefined();
  });

  it('injects class state, updates from onDataChanged and removes the listener on unmount', async () => {
    envManager.resetEnv('background');
    installInitData({ msg: 'init' });
    let instance: Component<unknown, { msg?: string; patch?: boolean }> | undefined;

    class App extends Component<unknown, { msg?: string; patch?: boolean }> {
      constructor(props: unknown) {
        super(props);
        instance = this;
      }

      render() {
        return <view />;
      }
    }

    const Wrapped = withInitDataInState(
      App as unknown as ComponentClass<unknown, { msg?: string; patch?: boolean }>,
    );

    root.render(<Wrapped />);
    expect(instance?.state).toEqual({ msg: 'init' });
    expect(emitter.listenerCount('onDataChanged')).toBe(1);

    lynx.__initData = { msg: 'full' };
    emitter.emit('onDataChanged', { patch: true });
    await waitForRender();

    expect(instance?.state).toEqual({ msg: 'init', patch: true });
    expect(globalCommitContext.flushOptions.triggerDataUpdated).toBe(true);

    root.render(null);
    expect(emitter.listenerCount('onDataChanged')).toBe(0);
  });
});
