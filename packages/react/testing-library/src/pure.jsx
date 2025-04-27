// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { configure as configureDTL, getQueriesForElement } from '@testing-library/dom';
import { cloneElement, createRef, h, render as preactRender } from 'preact';
import { useEffect } from 'preact/hooks';
import { act } from 'preact/test-utils';

import { __root } from '@lynx-js/react/internal';

import { commitToMainThread } from '../../runtime/lib/lifecycle/patch/commit.js';
import { flushDelayedLifecycleEvents } from '../../runtime/lib/lynx/tt.js';
import { clearPage } from '../../runtime/lib/snapshot.js';

export function waitSchedule() {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      setTimeout(resolve);
    });
  });
}

configureDTL({
  asyncWrapper: async cb => {
    let result;
    await act(() => {
      result = cb();
    });
    return result;
  },
  eventWrapper: cb => {
    let result;
    act(() => {
      result = cb();
    });
    return result;
  },
});

export function render(
  ui,
  {
    queries,
    wrapper: WrapperComponent,
    enableMainThread = false,
    enableBackgroundThread = true,
  } = {},
) {
  if (!enableMainThread && !enableBackgroundThread) {
    throw new Error(
      'You must enable at least one thread for rendering (enableMainThread or enableBackgroundThread)',
    );
  }
  const wrapUiIfNeeded = (innerElement) => (WrapperComponent
    ? h(WrapperComponent, null, innerElement)
    : innerElement);

  const comp = wrapUiIfNeeded(ui);
  const compMainThread = cloneElement(comp);
  const compBackgroundThread = cloneElement(comp);

  globalThis.lynxEnv.switchToMainThread();
  __root.__jsx = enableMainThread ? compMainThread : null;
  renderPage();
  if (enableBackgroundThread) {
    globalThis.lynxEnv.switchToBackgroundThread();
    act(() => {
      preactRender(compBackgroundThread, __root);
      flushDelayedLifecycleEvents();
    });
  }

  return {
    container: lynxEnv.mainThread.elementTree.root,
    unmount: cleanup,
    rerender: (rerenderUi) => {
      lynxEnv.resetLynxEnv();
      return render(wrapUiIfNeeded(rerenderUi), {
        queries,
        wrapper: WrapperComponent,
        enableMainThread,
        enableBackgroundThread,
      });
    },
    ...getQueriesForElement(lynxEnv.mainThread.elementTree.root, queries),
  };
}

export function cleanup() {
  const isMainThread = __MAIN_THREAD__;

  // Ensure componentWillUnmount is called
  globalThis.lynxEnv.switchToBackgroundThread();
  act(() => {
    preactRender(null, __root);
  });

  lynxEnv.mainThread.elementTree.root = undefined;
  clearPage();
  lynxEnv.jsdom.window.document.body.innerHTML = '';

  if (isMainThread) {
    globalThis.lynxEnv.switchToMainThread();
  }
}

export function renderHook(renderCallback, options) {
  const { initialProps, wrapper } = options || {};
  const result = createRef();

  function TestComponent({ renderCallbackProps }) {
    const pendingResult = renderCallback(renderCallbackProps);

    useEffect(() => {
      result.current = pendingResult;
    });

    return null;
  }

  const { rerender: baseRerender, unmount } = render(
    <TestComponent renderCallbackProps={initialProps} />,
    { wrapper },
  );

  function rerender(rerenderCallbackProps) {
    return baseRerender(
      <TestComponent renderCallbackProps={rerenderCallbackProps} />,
    );
  }

  return { result, rerender, unmount };
}

export * from '@testing-library/dom';
export { fireEvent } from './fire-event';
