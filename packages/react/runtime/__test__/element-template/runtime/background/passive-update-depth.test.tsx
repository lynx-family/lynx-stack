// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import 'preact/debug';
import type { Component, ComponentChildren, ContainerNode } from 'preact';
import { options, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetElementTemplateCommitState } from '../../../../src/element-template/background/commit-hook.js';
import {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  BackgroundElementTemplateInstance,
  BackgroundPageRootInstance,
} from '../../../../src/element-template/background/instance.js';
import { root, useEffect, useState } from '../../../../src/element-template/index.js';
import { clearRefState } from '../../../../src/element-template/prop-adapters/ref.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import { clearEtAttrPlanMap } from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

type InternalDebugOptions = typeof options & {
  _enqueueRender?: ((component: Component) => void) | undefined;
};

async function drainMicrotasks(turns = 20): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await Promise.resolve();
  }
}

async function drainUntil(predicate: () => boolean, maxTurns = 400): Promise<void> {
  for (let i = 0; i < maxTurns && !predicate(); i++) {
    await Promise.resolve();
  }
  await drainMicrotasks(5);
}

function readEtShadowText(node: BackgroundElementTemplateInstance | null | undefined): string {
  if (!node) {
    return '';
  }
  if (node.type === BUILTIN_RAW_TEXT_TEMPLATE_KEY) {
    return String(node.attributeSlots[0] ?? '');
  }
  const slotText = node.attributeSlots
    .map(v => (typeof v === 'string' || typeof v === 'number' ? String(v) : ''))
    .join('');
  let childrenText = '';
  let child = node.firstChild;
  while (child) {
    childrenText += readEtShadowText(child);
    child = child.nextSibling;
  }
  return slotText + childrenText;
}

describe('preact/debug - ElementTemplate passive effect update depth', () => {
  const envManager = new ElementTemplateEnvManager();
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearEtAttrPlanMap();
    clearRefState();
    resetElementTemplateCommitState();
    envManager.resetEnv('background');
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    root.render(null);
    await drainMicrotasks(10);
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it('does not warn at 50 updates, warns on the 51st with component stack, and continues a 100-pass loop', async () => {
    function Counter({ limit }: { limit: number }) {
      const [count, setCount] = useState(0);

      useEffect(() => {
        if (count < limit) {
          setCount(count + 1);
        }
      }, [count, limit]);

      return <text>{count}</text>;
    }

    function Wrapper({ children }: { children: ComponentChildren }) {
      return children;
    }

    function App({ limit }: { limit: number }) {
      return (
        <Wrapper>
          <Counter limit={limit} />
        </Wrapper>
      );
    }

    root.render(<App limit={50} />);
    await drainUntil(() => readEtShadowText(__root as BackgroundPageRootInstance) === '50');
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('50');
    expect(consoleError).not.toHaveBeenCalled();

    root.render(null);
    await drainMicrotasks(10);

    root.render(<App limit={51} />);
    await drainUntil(() => readEtShadowText(__root as BackgroundPageRootInstance) === '51');
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('51');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toContain('Maximum update depth exceeded');
    expect(consoleError.mock.calls[0]?.[0]).toMatch(/in Counter[\s\S]*in App/);

    consoleError.mockClear();
    root.render(null);
    await drainMicrotasks(10);

    root.render(<App limit={100} />);
    await drainUntil(() => readEtShadowText(__root as BackgroundPageRootInstance) === '100');
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('100');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toContain('Maximum update depth exceeded');
    expect(consoleError.mock.calls[0]?.[0]).toMatch(/in Counter[\s\S]*in App/);
  });

  it('warns when two components under one root update each other repeatedly', async () => {
    let kickA!: (value: number) => void;
    let kickB!: (value: number) => void;

    function CompA({ limit }: { limit: number }) {
      const [turn, setTurn] = useState(0);
      kickA = setTurn;
      useEffect(() => {
        if (turn < limit) {
          kickB(turn + 1);
        }
      }, [turn, limit]);
      return <text>{turn}</text>;
    }

    function CompB({ limit }: { limit: number }) {
      const [turn, setTurn] = useState(0);
      kickB = setTurn;
      useEffect(() => {
        if (turn > 0 && turn < limit) {
          kickA(turn + 1);
        }
      }, [turn, limit]);
      return <text>{turn}</text>;
    }

    function App({ limit }: { limit: number }) {
      return (
        <view>
          <CompA limit={limit} />
          <CompB limit={limit} />
        </view>
      );
    }

    root.render(<App limit={60} />);
    await drainUntil(() => readEtShadowText(__root as BackgroundPageRootInstance) === '6059');

    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('6059');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toContain('Maximum update depth exceeded');
    expect(consoleError.mock.calls[0]?.[0]).toMatch(/in (CompA|CompB)[\s\S]*in App/);
  });

  it('warns when a passive cleanup repeatedly schedules updates across dependency changes', async () => {
    let start!: () => void;

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
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('0');

    start();
    await drainUntil(() => readEtShadowText(__root as BackgroundPageRootInstance) === '60');

    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('60');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toContain('Maximum update depth exceeded');
    expect(consoleError.mock.calls[0]?.[0]).toMatch(/in CleanupCounter[\s\S]*in App/);
  });

  it('does not enqueue renders or count updates when setState receives the same value', async () => {
    const internalOptions = options as InternalDebugOptions;
    const previousEnqueueRender = internalOptions._enqueueRender;
    let enqueueCount = 0;
    internalOptions._enqueueRender = (component: Component) => {
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

      expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('0');
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

      expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('40');
      expect(enqueueCount).toBe(40);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      internalOptions._enqueueRender = previousEnqueueRender;
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
    await drainUntil(() => readEtShadowText(__root as BackgroundPageRootInstance) === '30-30-30');
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('30-30-30');
    expect(consoleError).not.toHaveBeenCalled();

    root.render(null);
    await drainMicrotasks(10);

    function SiblingWorker({ id }: { id: string }) {
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
    await drainUntil(() => readEtShadowText(__root as BackgroundPageRootInstance) === 'a:20;b:20;c:20;d:20;');
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('a:20;b:20;c:20;d:20;');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('resets the streak after a non-updating passive batch or an in-effect tree unmount on the same root', async () => {
    const initialRoot = __root;
    let resumeTo!: (target: number) => void;
    let idleBatchObserved = false;

    const weakMapDelete = vi.spyOn(WeakMap.prototype, 'delete');
    let deletedRootOnIdleFlush = false;

    function ResettableLoop() {
      const [count, setCount] = useState(0);
      const [target, setTarget] = useState(40);
      resumeTo = (nextTarget: number) => {
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
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('40');
    expect(deletedRootOnIdleFlush).toBe(true);

    // Resume for 45 more passive updates (40 -> 85): stays below 50 consecutive updates.
    resumeTo(85);
    await drainUntil(() => readEtShadowText(__root as BackgroundPageRootInstance) === '85');
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('85');
    expect(consoleError).not.toHaveBeenCalled();

    root.render(null);
    await drainMicrotasks(10);

    // Unmount inside a passive effect while `batch.root === __root`, after
    // scheduling an update in that same batch, then immediately remount on the
    // exact same `__root` instance. Without the unmount reset in `options._root`,
    // `root.render(<Loop ... />)` inside the active batch would keep the 40-pass
    // streak alive and the remounted 40-pass loop would exceed 50 at count 11.
    function LoopWithInEffectUnmount({
      limit,
      unmountAt,
      nextLimit,
    }: {
      limit: number;
      unmountAt?: number;
      nextLimit?: number;
    }) {
      const [count, setCount] = useState(0);
      useEffect(() => {
        if (unmountAt != null && nextLimit != null && count === unmountAt) {
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
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('40');
    expect(consoleError).not.toHaveBeenCalled();

    root.render(null);
    await drainMicrotasks(10);

    // Sanity check: remounting with nextLimit={51} on the same root still warns once.
    root.render(<LoopWithInEffectUnmount limit={40} unmountAt={40} nextLimit={51} />);
    await drainMicrotasks(360);
    expect(__root).toBe(initialRoot);
    expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('51');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toContain('Maximum update depth exceeded');
  });

  it('isolates streaks across independent ElementTemplate roots without cross-root inflation or reset', async () => {
    const secondRoot = new BackgroundPageRootInstance();

    try {
      // 1. No cross-root streak inflation across 60 passive flushes.
      let kickRoot1!: (value: number) => void;
      let kickRoot2!: (value: number) => void;

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

      render(<PongRoot2 />, secondRoot as unknown as ContainerNode);
      root.render(<PingRoot1 />);
      await drainUntil(
        () =>
          readEtShadowText(__root as BackgroundPageRootInstance) === '60'
          && readEtShadowText(secondRoot) === '59',
      );

      expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('60');
      expect(readEtShadowText(secondRoot)).toBe('59');
      expect(consoleError).not.toHaveBeenCalled();

      root.render(null);
      render(null, secondRoot as unknown as ContainerNode);
      await drainMicrotasks(10);

      // 2. No cross-root streak reset when secondRoot synchronously renders & unmounts mid-loop.
      render(<text>initial</text>, secondRoot as unknown as ContainerNode);

      function CheckedRoot1() {
        const [count, setCount] = useState(0);
        useEffect(() => {
          if (count === 25) {
            render(<text>updated</text>, secondRoot as unknown as ContainerNode);
            queueMicrotask(() => {
              render(null, secondRoot as unknown as ContainerNode);
            });
          }
          if (count < 55) {
            setCount(c => c + 1);
          }
        }, [count]);
        return <text>{count}</text>;
      }

      root.render(<CheckedRoot1 />);
      await drainUntil(() => readEtShadowText(__root as BackgroundPageRootInstance) === '55');

      expect(readEtShadowText(__root as BackgroundPageRootInstance)).toBe('55');
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]?.[0]).toContain('Maximum update depth exceeded');
      expect(consoleError.mock.calls[0]?.[0]).toContain('in CheckedRoot1');
    } finally {
      render(null, secondRoot as unknown as ContainerNode);
      await drainMicrotasks(10);
    }
  });
});
