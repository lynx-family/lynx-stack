import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'preact';

import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../../src/element-template/background/commit-hook.js';
import { BackgroundElementTemplateInstance } from '../../../../../src/element-template/background/instance.js';
import { root } from '../../../../../src/element-template/index.js';
import { __root } from '../../../../../src/element-template/runtime/page/root-instance.js';
import { ElementTemplateEnvManager } from '../../../test-utils/debug/envManager.js';

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function collectRawText(instance: BackgroundElementTemplateInstance): string[] {
  const texts: string[] = [];
  let child = instance.firstChild;
  while (child) {
    if (child.type === '_et_builtin_raw_text') {
      texts.push(child.text);
    }
    texts.push(...collectRawText(child));
    child = child.nextSibling;
  }
  return texts;
}

function App({ items }: { items: readonly string[] }): JSX.Element {
  return (
    <view>
      <view>header</view>
      {items.map(item => (
        <view key={item}>
          <text>{item}</text>
        </view>
      ))}
    </view>
  );
}

describe('Background Preact render', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
    resetElementTemplateCommitState();
    envManager.resetEnv('background');
  });

  it('keeps keyed children order stable when moving the previous head', () => {
    root.render(<App items={['1', '2', '3', '4']} />);
    markElementTemplateHydrated();

    root.render(<App items={['2', '1', '3', '4']} />);

    expect(collectRawText(__root as BackgroundElementTemplateInstance)).toEqual(['2', '1', '3', '4']);
  });

  it('keeps keyed children order stable across random shuffles', () => {
    const initial = Array.from({ length: 20 }, (_, i) => String(i));

    root.render(<App items={initial} />);
    markElementTemplateHydrated();

    for (let i = 0; i < 100; i += 1) {
      const next = shuffle(initial);

      root.render(<App items={next} />);

      expect(
        collectRawText(__root as BackgroundElementTemplateInstance),
        `shuffle iteration ${i}: ${JSON.stringify(next)}`,
      ).toEqual(next);
    }
  });

  // The Lynx Preact fork's `findMatchingIndex` requires
  // `oldVNode._slotIndex === newSlot` before keyed reuse (introduced by #2664),
  // so a same-key child cannot migrate across `$N` indices via `root.render`.
  // The old slot must end up empty because the previous child is fully
  // unmounted (not moved) and a fresh instance is mounted at the new slot.
  for (
    const [from, to] of [
      [2, 0],
      [1, 0],
    ] as const
  ) {
    it(`unmounts the old child when a same-key host child moves from $${from} to $${to}`, () => {
      const moved = createElement('_et_child', { key: 'moved' });
      root.render(createElement('_et_host', { [`$${from}`]: moved }));
      markElementTemplateHydrated();

      const initialHost = (__root as BackgroundElementTemplateInstance).firstChild!;
      const initialChild = initialHost.elementSlots[from]?.[0];
      expect(initialChild?.type).toBe('_et_child');

      root.render(createElement('_et_host', { [`$${to}`]: moved }));

      const host = (__root as BackgroundElementTemplateInstance).firstChild!;
      const movedChild = host.elementSlots[to]?.[0];
      expect(movedChild?.type).toBe('_et_child');
      expect(movedChild).not.toBe(initialChild);
      expect(host.elementSlots[from] ?? []).toEqual([]);
    });
  }
});
