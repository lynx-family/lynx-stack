import { describe, it, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { delayedLifecycleEvents } from '../../src/snapshot/lifecycle/event/delayLifecycleEvents';
import { flushDelayedLifecycleEvents } from '../../src/snapshot/lynx/tt';
import { __root } from '../../src/root';
import { globalEnvManager } from './utils/envManager';
import { expect } from 'vitest';
import { render } from 'preact';
import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';

beforeAll(() => {
  replaceCommitHook();
});

beforeEach(() => {
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
              "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__snapshot_a94a8_test_1"}]}",
            },
          ],
        ],
      ]
    `);
    lynx.getApp().OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    expect(delayedLifecycleEvents).toMatchInlineSnapshot(`
      [
        [
          "rLynxFirstScreen",
          {
            "firstScreenEventIdSwap": {},
            "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__snapshot_a94a8_test_1"}]}",
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
  it('dispatches the first-screen patch without inspecting event handlers', () => {
    const handler = vi.fn();
    handler.toJSON = vi.fn(() => {
      throw new Error('unexpected serialization');
    });
    function Comp() {
      return <view bindtap={handler} />;
    }

    __root.__jsx = <Comp />;
    renderPage();
    const event = globalThis.__OnLifecycleEvent.mock.calls[0];
    globalEnvManager.switchToBackground();
    render(<Comp />, __root);

    const alog = vi.spyOn(console, 'alog').mockImplementationOnce(() => {
      throw new Error('alog failed');
    });
    try {
      expect(() => lynx.getApp().OnLifecycleEvent(...event)).not.toThrow();
      expect(handler.toJSON).not.toHaveBeenCalled();
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledWith(
        'rLynxChange',
        expect.anything(),
        expect.any(Function),
      );
      expect(alog).toHaveBeenCalledWith(expect.stringMatching(/Snapshot hydrate start root=.+ payloadLength=\d+/));
      expect(alog).toHaveBeenCalledWith(
        expect.stringMatching(/Snapshot hydrate end .+ result=completed patchDispatched=true/),
      );
    } finally {
      alog.mockRestore();
    }
  });
});
