import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { delayedLifecycleEvents } from '../../src/snapshot/lifecycle/event/delayLifecycleEvents';
import { flushDelayedLifecycleEvents } from '../../src/snapshot/lynx/tt';
import { __root } from '../../src/root';
import { globalEnvManager } from './utils/envManager';
import { expect } from 'vitest';
import { render } from 'preact';
import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';

beforeEach(() => {
  replaceCommitHook();
  globalEnvManager.resetEnv();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('delayedLifecycleEvents', () => {
  it('should flush', async () => {
    function Comp() {
      return <view />;
    }
    __root.__jsx = <Comp />;
    renderPage();
    globalEnvManager.switchToBackground();
    expect(__FIRST_SCREEN_SYNC_TIMING__).toMatchInlineSnapshot(`"immediately"`);
    expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [
            "rLynxFirstScreen",
            {
              "firstScreenEventIdSwap": {},
              "root": "[1,["root","__snapshot_a94a8_test_1"],[-1,0,8,[[-2,1,0]]]]",
            },
          ],
        ],
      ]
    `);
    lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    expect(delayedLifecycleEvents).toMatchInlineSnapshot(`
      [
        [
          "rLynxFirstScreen",
          {
            "firstScreenEventIdSwap": {},
            "root": "[1,["root","__snapshot_a94a8_test_1"],[-1,0,8,[[-2,1,0]]]]",
          },
        ],
      ]
    `);
    render(
      <Comp />,
      __root,
    );
    flushDelayedLifecycleEvents();
    expect(delayedLifecycleEvents).toMatchInlineSnapshot(`[]`);
  });
});
