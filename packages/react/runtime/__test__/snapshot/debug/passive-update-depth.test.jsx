// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import 'preact/debug';
import { options, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPortal, root, useEffect, useState } from '../../../src/index';
import { __root } from '../../../src/root';
import { BackgroundSnapshotInstance } from '../../../src/snapshot/snapshot/backgroundSnapshot.js';
import { clearPendingPortalInsertBefore } from '../../../src/snapshot/lynx/portalsPending';
import { globalEnvManager } from '../utils/envManager';

async function drainMicrotasks(turns = 20) {
  for (let i = 0; i < turns; i++) {
    await Promise.resolve();
  }
}

async function drainUntil(predicate, maxTurns = 400) {
  for (let i = 0; i < maxTurns && !predicate(); i++) {
    await Promise.resolve();
  }
  await drainMicrotasks(5);
}

function readSnapshotText(instance) {
  if (!instance) {
    return '';
  }
  const values = Array.isArray(instance.__values)
    ? instance.__values.map(v => (v == null ? '' : String(v))).join('')
    : '';
  const childrenText = (instance.childNodes ?? []).map(readSnapshotText).join('');
  return values + childrenText;
}

describe('preact/debug - Snapshot passive effect update depth', () => {
  let consoleError;
  let consoleWarn;

  beforeEach(() => {
    globalEnvManager.resetEnv();
    globalEnvManager.switchToBackground();
    clearPendingPortalInsertBefore();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    root.render(null);
    await drainMicrotasks(10);
    clearPendingPortalInsertBefore();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it('does not warn at 50 updates, warns on the 51st with component stack, and continues a 100-pass loop', async () => {
    function Counter({ limit }) {
      const [count, setCount] = useState(0);

      useEffect(() => {
        if (count < limit) {
          setCount(count + 1);
        }
      }, [count, limit]);

      return <text>{count}</text>;
    }

    function Wrapper(props) {
      return props.children;
    }

    function App({ limit }) {
      return (
        <Wrapper>
          <Counter limit={limit} />
        </Wrapper>
      );
    }

    root.render(<App limit={50} />);
    await drainUntil(() => readSnapshotText(__root) === '50');
    expect(readSnapshotText(__root)).toBe('50');
    expect(consoleError).not.toHaveBeenCalled();

    root.render(null);
    await drainMicrotasks(10);

    root.render(<App limit={51} />);
    await drainUntil(() => readSnapshotText(__root) === '51');
    expect(readSnapshotText(__root)).toBe('51');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain('Maximum update depth exceeded');
    expect(consoleError.mock.calls[0][0]).toMatch(/in Counter[\s\S]*in App/);

    consoleError.mockClear();
    root.render(null);
    await drainMicrotasks(10);

    root.render(<App limit={100} />);
    await drainUntil(() => readSnapshotText(__root) === '100');
    expect(readSnapshotText(__root)).toBe('100');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain('Maximum update depth exceeded');
    expect(consoleError.mock.calls[0][0]).toMatch(/in Counter[\s\S]*in App/);
  });

  it('warns when two components under one root update each other repeatedly', async () => {
    let kickA;
    let kickB;

    function CompA({ limit }) {
      const [turn, setTurn] = useState(0);
      kickA = setTurn;
      useEffect(() => {
        if (turn < limit) {
          kickB(turn + 1);
        }
      }, [turn, limit]);
      return <text>{turn}</text>;
    }

    function CompB({ limit }) {
      const [turn, setTurn] = useState(0);
      kickB = setTurn;
      useEffect(() => {
        if (turn > 0 && turn < limit) {
          kickA(turn + 1);
        }
      }, [turn, limit]);
      return <text>{turn}</text>;
    }

    function App({ limit }) {
      return (
        <view>
          <CompA limit={limit} />
          <CompB limit={limit} />
        </view>
      );
    }

    root.render(<App limit={60} />);
    await drainUntil(() => readSnapshotText(__root) === '6059');

    expect(readSnapshotText(__root)).toBe('6059');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain('Maximum update depth exceeded');
    expect(consoleError.mock.calls[0][0]).toMatch(/in (CompA|CompB)[\s\S]*in App/);
  });

  it('warns when a passive cleanup repeatedly schedules updates across dependency changes', async () => {
    let start;

    function CleanupCounter() {
      const [count, setCount] = useState(0);
      start = () => setCount(1);

      useEffect(() => {
        return () => {
          setCount(c => (c < 60 ? c + 1 : c));
        };
      }, [count]);

      return <text>{count}</text>;
    }

    function App() {
      return <CleanupCounter />;
    }

    root.render(<App />);
    await drainMicrotasks(10);
    expect(readSnapshotText(__root)).toBe('0');

    start();
    await drainUntil(() => readSnapshotText(__root) === '60');

    expect(readSnapshotText(__root)).toBe('60');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain('Maximum update depth exceeded');
    expect(consoleError.mock.calls[0][0]).toMatch(/in CleanupCounter[\s\S]*in App/);
  });

  it('does not enqueue renders or count updates when setState receives the same value', async () => {
    const previousEnqueueRender = options._enqueueRender;
    let enqueueCount = 0;
    options._enqueueRender = component => {
      enqueueCount++;
      previousEnqueueRender?.(component);
    };

    try {
      let renderRuns = 0;
      let effectRuns = 0;

      // No dependency array: if same-value setState enqueued a render, this
      // effect would loop indefinitely and hit Maximum update depth exceeded.
      function SameValueNoDeps() {
        const [value, setValue] = useState(0);
        renderRuns++;
        useEffect(() => {
          effectRuns++;
          setValue(0);
          setValue(prev => prev);
        });
        return <text>{value}</text>;
      }

      root.render(<SameValueNoDeps />);
      await drainMicrotasks(150);

      expect(readSnapshotText(__root)).toBe('0');
      expect(renderRuns).toBe(1);
      expect(effectRuns).toBe(1);
      expect(enqueueCount).toBe(0);
      expect(consoleError).not.toHaveBeenCalled();

      root.render(null);
      await drainMicrotasks(10);
      enqueueCount = 0;

      let settledEffectRan = false;
      function SameValueAtTail() {
        const [count, setCount] = useState(0);
        useEffect(() => {
          if (count < 40) {
            setCount(count + 1);
          } else {
            settledEffectRan = true;
            setCount(40);
            setCount(prev => prev);
          }
        }, [count]);
        return <text>{count}</text>;
      }

      root.render(<SameValueAtTail />);
      await drainUntil(() => settledEffectRan);

      expect(readSnapshotText(__root)).toBe('40');
      expect(enqueueCount).toBe(40);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      options._enqueueRender = previousEnqueueRender;
    }
  });

  it('counts at most once per root per passive batch when multiple setters or components update', async () => {
    function MultiSetter() {
      const [a, setA] = useState(0);
      const [b, setB] = useState(0);
      const [c, setC] = useState(0);

      useEffect(() => {
        if (a < 30) {
          setA(v => v + 1);
          setB(v => v + 1);
          setC(v => v + 1);
        }
      }, [a]);

      return <text>{`${a}-${b}-${c}`}</text>;
    }

    root.render(<MultiSetter />);
    await drainUntil(() => readSnapshotText(__root) === '30-30-30');
    expect(readSnapshotText(__root)).toBe('30-30-30');
    expect(consoleError).not.toHaveBeenCalled();

    root.render(null);
    await drainMicrotasks(10);

    function SiblingWorker({ id }) {
      const [step, setStep] = useState(0);
      useEffect(() => {
        if (step < 20) {
          setStep(s => s + 1);
        }
      }, [step]);
      return <text>{`${id}:${step};`}</text>;
    }

    function MultiComponentBatchApp() {
      return (
        <view>
          <SiblingWorker id='a' />
          <SiblingWorker id='b' />
          <SiblingWorker id='c' />
          <SiblingWorker id='d' />
        </view>
      );
    }

    root.render(<MultiComponentBatchApp />);
    await drainUntil(() => readSnapshotText(__root) === 'a:20;b:20;c:20;d:20;');
    expect(readSnapshotText(__root)).toBe('a:20;b:20;c:20;d:20;');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('resets the streak after a non-updating passive batch or an in-effect tree unmount on the same root', async () => {
    const initialRoot = __root;
    let resumeTo;
    let idleBatchObserved = false;

    const weakMapDelete = vi.spyOn(WeakMap.prototype, 'delete');
    let deletedRootOnIdleFlush = false;

    function ResettableLoop() {
      const [count, setCount] = useState(0);
      const [target, setTarget] = useState(40);
      resumeTo = nextTarget => {
        setTarget(nextTarget);
      };

      useEffect(() => {
        if (count < target) {
          setCount(c => c + 1);
        } else if (count === 40) {
          weakMapDelete.mockClear();
          idleBatchObserved = true;
        }
      }, [count, target]);

      return <text>{count}</text>;
    }

    try {
      root.render(<ResettableLoop />);
      await drainUntil(() => idleBatchObserved);
      deletedRootOnIdleFlush = weakMapDelete.mock.calls.some(([key]) => key === __root);
    } finally {
      weakMapDelete.mockRestore();
    }
    expect(readSnapshotText(__root)).toBe('40');
    expect(deletedRootOnIdleFlush).toBe(true);

    // Resume for 45 more passive updates (40 -> 85): stays below 50 consecutive updates.
    resumeTo(85);
    await drainUntil(() => readSnapshotText(__root) === '85');
    expect(readSnapshotText(__root)).toBe('85');
    expect(consoleError).not.toHaveBeenCalled();

    root.render(null);
    await drainMicrotasks(10);

    // Unmount inside a passive effect while `batch.root === __root`, after
    // scheduling an update in that same batch, then immediately remount on the
    // exact same `__root`. Without the unmount reset in `options._root`,
    // `root.render(<Loop ... />)` inside the active batch would keep the 40-pass
    // streak alive and the remounted 40-pass loop would exceed 50 at count 11.
    function LoopWithInEffectUnmount({ limit, unmountAt, nextLimit }) {
      const [count, setCount] = useState(0);
      useEffect(() => {
        if (unmountAt != null && count === unmountAt) {
          setCount(c => c + 1);
          root.render(null);
          root.render(<LoopWithInEffectUnmount limit={nextLimit} />);
          return;
        }
        if (count < limit) {
          setCount(c => c + 1);
        }
      }, [count, limit, unmountAt, nextLimit]);
      return <text>{count}</text>;
    }

    root.render(<LoopWithInEffectUnmount limit={40} unmountAt={40} nextLimit={40} />);
    await drainMicrotasks(320);
    expect(__root).toBe(initialRoot);
    expect(readSnapshotText(__root)).toBe('40');
    expect(consoleError).not.toHaveBeenCalled();

    root.render(null);
    await drainMicrotasks(10);

    // Sanity check: remounting with nextLimit={51} on the same root still warns once.
    root.render(<LoopWithInEffectUnmount limit={40} unmountAt={40} nextLimit={51} />);
    await drainMicrotasks(360);
    expect(__root).toBe(initialRoot);
    expect(readSnapshotText(__root)).toBe('51');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain('Maximum update depth exceeded');
  });

  it('tracks independent roots separately, falsifying cross-root inflation and cross-root reset', async () => {
    const secondRoot = new BackgroundSnapshotInstance('root');
    secondRoot.nodeType = 1;
    const portalTarget = { _nodeSelectToken: { identifier: '#portal', type: 0 } };

    try {
      // 1. No cross-root streak inflation between __root and secondRoot across 60 passive flushes.
      let kickRoot1;
      let kickRoot2;

      function PingRoot1() {
        const [turn, setTurn] = useState(0);
        kickRoot1 = setTurn;
        useEffect(() => {
          if (turn < 60) {
            kickRoot2(turn + 1);
          }
        }, [turn]);
        return <text>{turn}</text>;
      }

      function PongRoot2() {
        const [turn, setTurn] = useState(0);
        kickRoot2 = setTurn;
        useEffect(() => {
          if (turn > 0 && turn < 60) {
            kickRoot1(turn + 1);
          }
        }, [turn]);
        return <text>{turn}</text>;
      }

      render(<PongRoot2 />, secondRoot);
      root.render(<PingRoot1 />);
      await drainUntil(() => readSnapshotText(__root) === '60' && readSnapshotText(secondRoot) === '59');

      expect(readSnapshotText(__root)).toBe('60');
      expect(readSnapshotText(secondRoot)).toBe('59');
      expect(consoleError).not.toHaveBeenCalled();

      root.render(null);
      render(null, secondRoot);
      await drainMicrotasks(10);

      // 2. No cross-root streak inflation between __root and createPortal across 60 passive flushes.
      let kickMainPeer;
      let kickPortalPeer;
      let latestPortalTurn = 0;

      function MainPeer() {
        const [turn, setTurn] = useState(0);
        kickMainPeer = setTurn;
        useEffect(() => {
          if (turn < 60) {
            kickPortalPeer(turn + 1);
          }
        }, [turn]);
        return <text>{turn}</text>;
      }

      function PortalPeer() {
        const [turn, setTurn] = useState(0);
        kickPortalPeer = setTurn;
        latestPortalTurn = turn;
        useEffect(() => {
          if (turn > 0 && turn < 60) {
            kickMainPeer(turn + 1);
          }
        }, [turn]);
        return <text>{turn}</text>;
      }

      function AppWithPortalPingPong() {
        return (
          <view>
            <MainPeer />
            {createPortal(<PortalPeer />, portalTarget)}
          </view>
        );
      }

      root.render(<AppWithPortalPingPong />);
      await drainUntil(() => readSnapshotText(__root) === '60' && latestPortalTurn === 59);

      expect(readSnapshotText(__root)).toBe('60');
      expect(latestPortalTurn).toBe(59);
      expect(consoleError).not.toHaveBeenCalled();

      root.render(null);
      await drainMicrotasks(10);

      // 3. No cross-root streak reset when secondRoot synchronously renders & unmounts mid-loop.
      render(<text>initial</text>, secondRoot);

      function LoopingRoot1() {
        const [count, setCount] = useState(0);
        useEffect(() => {
          if (count === 25) {
            render(<text>updated</text>, secondRoot);
            queueMicrotask(() => {
              render(null, secondRoot);
            });
          }
          if (count < 55) {
            setCount(c => c + 1);
          }
        }, [count]);
        return <text>{count}</text>;
      }

      root.render(<LoopingRoot1 />);
      await drainUntil(() => readSnapshotText(__root) === '55');

      expect(readSnapshotText(__root)).toBe('55');
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0][0]).toContain('Maximum update depth exceeded');
      expect(consoleError.mock.calls[0][0]).toContain('in LoopingRoot1');

      consoleError.mockClear();
      root.render(null);
      await drainMicrotasks(10);

      // 4. No cross-root streak reset when createPortal's fakeRoot unmounts mid-loop.
      let unmountPortal;
      function PortalMountToggle() {
        const [mounted, setMounted] = useState(true);
        unmountPortal = () => setMounted(false);
        return mounted ? createPortal(<text>portal</text>, portalTarget) : null;
      }

      function LoopingMainWithPortalUnmount() {
        const [count, setCount] = useState(0);
        useEffect(() => {
          if (count === 25) {
            unmountPortal();
          }
          if (count < 55) {
            setCount(c => c + 1);
          }
        }, [count]);
        return <text>{count}</text>;
      }

      root.render(
        <view>
          <LoopingMainWithPortalUnmount />
          <PortalMountToggle />
        </view>,
      );
      await drainUntil(() => readSnapshotText(__root) === '55');

      expect(readSnapshotText(__root)).toBe('55');
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0][0]).toContain('Maximum update depth exceeded');
      expect(consoleError.mock.calls[0][0]).toContain('in LoopingMainWithPortalUnmount');
    } finally {
      render(null, secondRoot);
      await drainMicrotasks(10);
    }
  });
});
