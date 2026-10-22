// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { useInitData } from '@lynx-js/react';

import { render } from '../..';
import { reloadTemplate } from './reloadTemplate.js';
import { resetFirstScreenSyncState } from '../../../../runtime/lib/snapshot/lifecycle/event/firstScreenSync.js';

function App() {
  const { text = 'Hello' } = useInitData() ?? {};
  return (
    <view>
      <text>{text}</text>
    </view>
  );
}

const mainThreadGlobals = () => lynxTestingEnv.mainThread.globalThis;

afterEach(() => {
  delete mainThreadGlobals().lepusng_gc;
  mainThreadGlobals().__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
});

describe('gc after the rendered tree is replaced', () => {
  it('runs after reloadTemplate', () => {
    const gc = vi.fn();
    mainThreadGlobals().lepusng_gc = gc;
    const ui = <App />;
    const { container } = render(ui, { enableMainThread: true });
    expect(gc).not.toHaveBeenCalled();

    reloadTemplate(ui, { text: 'Enjoy' });
    expect(gc).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe('<view><text>Enjoy</text></view>');
  });

  it('runs after an update before first-screen sync, not after one that follows it', () => {
    const gc = vi.fn();
    mainThreadGlobals().lepusng_gc = gc;
    mainThreadGlobals().__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
    resetFirstScreenSyncState();
    const { container } = render(<App />, { enableMainThread: true, enableBackgroundThread: false });

    lynxTestingEnv.switchToMainThread();
    globalThis.updatePage({ text: 'Enjoy' });
    expect(gc).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe('<view><text>Enjoy</text></view>');

    globalThis.rLynxFirstScreenSyncReady();
    globalThis.updatePage({ text: 'Again' });
    expect(gc).toHaveBeenCalledTimes(1);
  });

  it('is skipped when the engine does not expose it', () => {
    const ui = <App />;
    render(ui, { enableMainThread: true });
    expect(() => reloadTemplate(ui, { text: 'Enjoy' })).not.toThrow();
  });
});
