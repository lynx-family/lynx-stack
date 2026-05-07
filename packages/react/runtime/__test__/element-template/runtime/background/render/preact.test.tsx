import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    if (child.type === '__et_builtin_raw_text__') {
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
});
