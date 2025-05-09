import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { delayedLifecycleEvents } from '../src/lifecycle/event/delayLifecycleEvents';
import { flushDelayedLifecycleEvents } from '../src/lynx/tt';
import { __root } from '../src/root';
import { globalEnvManager } from './utils/envManager';
import { expect } from 'vitest';
import { render } from 'preact';
import { globalCommitTaskMap, replaceCommitHook, replaceRequestAnimationFrame } from '../src/lifecycle/patch/commit';

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
              "jsReadyEventIdSwap": {},
              "refPatch": "{}",
              "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_1"}]}",
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
            "jsReadyEventIdSwap": {},
            "refPatch": "{}",
            "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_1"}]}",
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
