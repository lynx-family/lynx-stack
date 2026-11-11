import { options } from 'preact';
import type { ComponentChildren } from 'preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installElementTemplateHydrationListener } from '../../../../src/element-template/background/hydration-listener.js';
import { isElementTemplateRendering } from '../../../../src/element-template/background/render-scope.js';
import { injectCalledByNative } from '../../../../src/element-template/native/main-thread-api.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

describe('ElementTemplate background component stack', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
    envManager.resetEnv('background');
  });

  it('reports component owners for circular attributes in hydrated background updates', async () => {
    const scheduledRenders: Array<() => void> = [];
    const previousDebounce = options.debounceRendering;
    const previousProfile = globalThis.__PROFILE__;
    const dispatchEvent = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent');
    options.debounceRendering = callback => scheduledRenders.push(callback);
    globalThis.__PROFILE__ = false;
    const { root, useState } = await import('../../../../src/element-template/index.js');
    const { renderCompiledFixtureOnMainThread } = await import('../../test-utils/debug/compiledThreadRunner.js');
    let updateValue: (value: Record<string, unknown>) => void;

    function PassThrough({ children }: { children: ComponentChildren }) {
      return children;
    }

    function AttributeOwner() {
      const [value, setValue] = useState<Record<string, unknown>>({ count: 0 });
      if (__BACKGROUND__) updateValue = setValue;
      return (
        <view>
          <text>prefix</text>
          <view data-value={value} />
        </view>
      );
    }

    function App() {
      return (
        <PassThrough>
          <AttributeOwner />
        </PassThrough>
      );
    }

    try {
      installElementTemplateHydrationListener();
      injectCalledByNative();
      root.render(<App />);
      renderCompiledFixtureOnMainThread({ App }, envManager);
      dispatchEvent.mockClear();

      updateValue!({ count: 1 });
      scheduledRenders.shift()!();
      expect(isElementTemplateRendering()).toBe(false);
      expect(dispatchEvent).toHaveBeenCalled();

      const circular: Record<string, unknown> = {};
      circular['self'] = circular;
      updateValue!(circular);
      expect(() => scheduledRenders.shift()!()).toThrowError(
        /Converting circular structure to JSON[\s\S]*in AttributeOwner\n  in App\n/,
      );
    } finally {
      options.debounceRendering = previousDebounce;
      globalThis.__PROFILE__ = previousProfile;
      dispatchEvent.mockRestore();
    }
  });
});
