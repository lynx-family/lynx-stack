/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupDocument } from '../../src/document';
import { setupPage, snapshotInstanceManager } from '../../src/snapshot';
import { elementTree } from '../utils/nativeMethod';

async function importHooksWithProfileRecording(isRecording) {
  const original = lynx.performance.isProfileRecording;
  lynx.performance.isProfileRecording = vi.fn(() => isRecording);
  vi.resetModules();
  try {
    return await import('../../src/hooks/react');
  } finally {
    lynx.performance.isProfileRecording = original;
  }
}

describe('react hooks profile', () => {
  let scratch;

  beforeAll(() => {
    setupDocument();
    setupPage(__CreatePage('0', 0));
  });

  beforeEach(() => {
    snapshotInstanceManager.clear();
    scratch = document.createElement('root');
  });

  afterEach(() => {
    render(null, scratch);
    elementTree.clear();
    vi.restoreAllMocks();
  });

  it('should profile useEffect and useLayoutEffect with flowId and cleanup', async () => {
    const { useEffect, useLayoutEffect } = await importHooksWithProfileRecording(true);

    function App() {
      useEffect(() => {
        return () => {};
      }, []);
      useLayoutEffect(() => {
        return () => {};
      }, []);
      return <view />;
    }

    lynx.performance.profileStart.mockClear();
    lynx.performance.profileEnd.mockClear();
    lynx.performance.profileFlowId.mockClear();

    render(<App />, scratch);
    await Promise.resolve();
    render(null, scratch);
    await Promise.resolve();

    const starts = lynx.performance.profileStart.mock.calls;
    const effectCalls = starts.filter(([traceName]) => (
      traceName.startsWith('ReactLynx::hooks::useEffect')
    ));
    const layoutCalls = starts.filter(([traceName]) => (
      traceName.startsWith('ReactLynx::hooks::useLayoutEffect')
    ));

    expect(effectCalls.some(([traceName]) => traceName === 'ReactLynx::hooks::useEffect')).toBe(true);
    expect(effectCalls.some(([traceName]) => traceName === 'ReactLynx::hooks::useEffect::callback')).toBe(true);
    expect(effectCalls.some(([traceName]) => traceName === 'ReactLynx::hooks::useEffect::callback::cleanup')).toBe(
      true,
    );
    expect(layoutCalls.some(([traceName]) => traceName === 'ReactLynx::hooks::useLayoutEffect')).toBe(true);
    expect(layoutCalls.some(([traceName]) => traceName === 'ReactLynx::hooks::useLayoutEffect::callback')).toBe(true);
    expect(layoutCalls.some(([traceName]) => traceName === 'ReactLynx::hooks::useLayoutEffect::callback::cleanup'))
      .toBe(true);
    expect(lynx.performance.profileFlowId).toBeCalledTimes(2);

    [...effectCalls, ...layoutCalls].forEach(([, option]) => {
      expect(option).toEqual(
        expect.objectContaining({
          flowId: 666,
          args: expect.objectContaining({
            stack: expect.any(String),
          }),
        }),
      );
      expect(option.args.stack.length).toBeGreaterThan(0);
    });
  });

  it('should skip stack payload when Error.stack is missing in useState setter profile', async () => {
    const { useState } = await importHooksWithProfileRecording(true);
    let setValue;

    function App() {
      const [value, _setValue] = useState(0);
      setValue = _setValue;
      return <view value={value} />;
    }

    render(<App />, scratch);

    const OriginalError = globalThis.Error;
    class ErrorWithoutStack extends OriginalError {
      constructor(...args) {
        super(...args);
        this.stack = undefined;
      }
    }

    lynx.performance.profileStart.mockClear();
    lynx.performance.profileEnd.mockClear();

    try {
      vi.stubGlobal('Error', ErrorWithoutStack);
      setValue(v => v + 1);
    } finally {
      vi.stubGlobal('Error', OriginalError);
    }

    const setterProfileCalls = lynx.performance.profileStart.mock.calls.filter(
      ([traceName]) => traceName === 'ReactLynx::hooks::useState::setter',
    );

    expect(setterProfileCalls).toHaveLength(1);
    expect(setterProfileCalls[0][1]).toBeUndefined();
  });

  it('should use flowId-only trace option when stack is missing in effect profile', async () => {
    const { useEffect } = await importHooksWithProfileRecording(true);

    function App() {
      useEffect(() => undefined, []);
      return <view />;
    }

    const OriginalError = globalThis.Error;
    class ErrorWithoutStack extends OriginalError {
      constructor(...args) {
        super(...args);
        this.stack = undefined;
      }
    }

    lynx.performance.profileStart.mockClear();
    lynx.performance.profileEnd.mockClear();

    try {
      vi.stubGlobal('Error', ErrorWithoutStack);
      render(<App />, scratch);
      await Promise.resolve();
    } finally {
      vi.stubGlobal('Error', OriginalError);
    }

    const effectRootCall = lynx.performance.profileStart.mock.calls.find(
      ([traceName]) => traceName === 'ReactLynx::hooks::useEffect',
    );
    const effectCallbackCall = lynx.performance.profileStart.mock.calls.find(
      ([traceName]) => traceName === 'ReactLynx::hooks::useEffect::callback',
    );

    expect(effectRootCall?.[1]).toEqual({ flowId: 666 });
    expect(effectCallbackCall?.[1]).toEqual({ flowId: 666 });
  });

  it('should support useState without initial value in profiling mode', async () => {
    const { useState } = await importHooksWithProfileRecording(true);
    let setValue;

    function App() {
      const [value, _setValue] = useState();
      setValue = _setValue;
      return <view value={value} />;
    }

    render(<App />, scratch);

    lynx.performance.profileStart.mockClear();
    lynx.performance.profileEnd.mockClear();

    setValue(1);

    const setterProfileCalls = lynx.performance.profileStart.mock.calls.filter(
      ([traceName]) => traceName === 'ReactLynx::hooks::useState::setter',
    );

    expect(setterProfileCalls).toHaveLength(1);
    expect(setterProfileCalls[0][1]).toEqual(
      expect.objectContaining({
        args: expect.objectContaining({
          stack: expect.any(String),
        }),
      }),
    );
  });

  it('should profile useState setter with realtime stack', async () => {
    const { useState } = await importHooksWithProfileRecording(true);
    let setValue;

    function App() {
      const [value, _setValue] = useState(0);
      setValue = _setValue;
      return <view value={value} />;
    }

    render(<App />, scratch);

    lynx.performance.profileStart.mockClear();
    lynx.performance.profileEnd.mockClear();

    setValue(v => v);

    const setterProfileCalls = lynx.performance.profileStart.mock.calls.filter(
      ([traceName]) => traceName === 'ReactLynx::hooks::useState::setter',
    );

    expect(setterProfileCalls).toHaveLength(1);
    expect(setterProfileCalls[0][1]).toEqual(
      expect.objectContaining({
        args: expect.objectContaining({
          stack: expect.any(String),
        }),
      }),
    );
    expect(setterProfileCalls[0][1].args.stack.length).toBeGreaterThan(0);
  });

  it('should not profile hooks when profiling is disabled', async () => {
    const { useEffect, useLayoutEffect, useState } = await importHooksWithProfileRecording(false);
    const preactHooks = await import('preact/hooks');
    let setValue;

    function App() {
      const [value, _setValue] = useState(0);
      setValue = _setValue;
      useEffect(() => undefined, [value]);
      useLayoutEffect(() => undefined, [value]);
      return <view value={value} />;
    }

    lynx.performance.profileStart.mockClear();
    lynx.performance.profileEnd.mockClear();
    lynx.performance.profileFlowId.mockClear();

    expect(useState).toBe(preactHooks.useState);
    expect(useEffect).toBe(preactHooks.useEffect);
    expect(useLayoutEffect).toBe(preactHooks.useEffect);

    render(<App />, scratch);
    await Promise.resolve();
    setValue(v => v + 1);
    await Promise.resolve();

    const hookTraceCalls = lynx.performance.profileStart.mock.calls.filter(([traceName]) => (
      traceName.startsWith('ReactLynx::hooks::')
    ));

    expect(hookTraceCalls).toHaveLength(0);
  });
});
