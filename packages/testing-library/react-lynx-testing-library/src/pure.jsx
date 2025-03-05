import {
  getQueriesForElement,
  configure as configureDTL,
} from '@lynx-js/lynx-dom-testing-library';
import { h, render as preactRender, createRef } from 'preact';
import { useEffect } from 'preact/hooks';
import { cloneElement } from 'preact';
import { __root } from '@lynx-js/react/internal';
import { flushDelayedLifecycleEvents } from '@lynx-js/react/runtime/lib/lynx/tt.js';

export function waitSchedule() {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      setTimeout(resolve);
    });
  });
}

configureDTL({
  asyncWrapper: cb => {
    let result = cb();
    return result;
  },
  eventWrapper: cb => {
    let result = cb();
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

  globalThis.lynxDOM.switchToMainThread();
  __root.__jsx = enableMainThread ? compMainThread : null;
  renderPage();
  if (enableBackgroundThread) {
    globalThis.lynxDOM.switchToBackgroundThread();
    preactRender(compBackgroundThread, __root);
    flushDelayedLifecycleEvents();
  }

  return {
    container: lynxDOM.mainThread.elementTree.root,
    unmount: cleanup,
    rerender: (rerenderUi) => {
      lynxDOM.resetLynxEnv();
      return render(wrapUiIfNeeded(rerenderUi), {});
    },
    ...getQueriesForElement(lynxDOM.mainThread.elementTree.root, queries),
  };
}

export function cleanup() {
  const isMainThread = !__LEPUS__;

  // Ensure componentWillUnmount is called
  globalThis.lynxDOM.switchToBackgroundThread();
  preactRender(null, __root);

  lynxDOM.mainThread.elementTree.root = undefined;

  if (isMainThread) {
    globalThis.lynxDOM.switchToMainThread();
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

export * from '@lynx-js/lynx-dom-testing-library';
export { fireEvent } from './fire-event';
