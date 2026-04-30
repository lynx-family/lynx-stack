import { options } from 'preact';

import * as mainThreadHooks from '../../../../src/core/hooks/mainThreadImpl.js';

type HookState = {
  value?: unknown;
  deps?: ReadonlyArray<unknown>;
};

type HookedComponent = {
  __etHooks?: HookState[];
  setState?: (state: unknown) => void;
  __d?: boolean;
  _dirty?: boolean;
  context?: Record<string, unknown>;
};

type HookedVNode = {
  __c?: HookedComponent;
  _component?: HookedComponent;
  __?: HookedVNode | null;
  _parent?: HookedVNode | null;
  __m?: [number, number];
  _mask?: [number, number];
};

let backgroundHooksInstalled = false;
let currentComponent: HookedComponent | undefined;
let currentVNode: HookedVNode | undefined;
let currentIndex = 0;

function installBackgroundHooks(): void {
  if (backgroundHooksInstalled) {
    return;
  }
  backgroundHooksInstalled = true;

  const onRender = (vnode: HookedVNode) => {
    currentVNode = vnode;
    currentComponent = vnode._component ?? vnode.__c;
    currentIndex = 0;
  };
  options._render = onRender;
  options.__r = onRender;

  const onDiffed = (vnode: HookedVNode) => {
    currentVNode = undefined;
    currentComponent = undefined;
  };
  options.diffed = onDiffed;
}

installBackgroundHooks();

function useBackgroundHook(): HookState {
  const component = currentComponent;
  if (!component) {
    throw new Error('ET background hooks were called outside component render.');
  }
  const hooks = component.__etHooks ??= [];
  const hook = hooks[currentIndex] ??= {};
  currentIndex += 1;
  return hook;
}

function depsChanged(prev: ReadonlyArray<unknown> | undefined, next: ReadonlyArray<unknown> | undefined): boolean {
  if (!prev || !next || prev.length !== next.length) {
    return true;
  }
  return next.some((value, index) => !Object.is(value, prev[index]));
}

function resolveState<S>(action: S | ((prevState: S) => S), prevState: S): S {
  return typeof action === 'function'
    ? (action as (prevState: S) => S)(prevState)
    : action;
}

function useBackgroundState<S>(initialState: S | (() => S)): [S, (action: S | ((prevState: S) => S)) => void] {
  const hook = useBackgroundHook();
  const component = currentComponent!;
  if (!('value' in hook)) {
    hook.value = typeof initialState === 'function'
      ? (initialState as () => S)()
      : initialState;
  }
  const setState = (action: S | ((prevState: S) => S)) => {
    const nextState = resolveState(action, hook.value as S);
    if (Object.is(nextState, hook.value)) {
      return;
    }
    hook.value = nextState;
    if (component.setState) {
      component.setState({});
    } else {
      component.__d = true;
      component._dirty = true;
    }
  };
  return [hook.value as S, setState];
}

function useBackgroundReducer<S, A>(
  reducer: (prevState: S, action: A) => S,
  initialState: S | (() => S),
  init?: (initialState: S) => S,
): [S, (action: A) => void] {
  const initializer = () =>
    init
      ? init(initialState as S)
      : (typeof initialState === 'function' ? (initialState as () => S)() : initialState);
  const [state, setState] = useBackgroundState<S>(initializer);
  return [state, action => setState(prevState => reducer(prevState, action))];
}

function useBackgroundMemo<T>(factory: () => T, deps?: ReadonlyArray<unknown>): T {
  const hook = useBackgroundHook();
  if (!('value' in hook) || depsChanged(hook.deps, deps)) {
    hook.value = factory();
    hook.deps = deps;
  }
  return hook.value as T;
}

function useBackgroundRef<T>(initialValue?: T): { current: T | undefined } {
  return useBackgroundMemo(() => ({ current: initialValue }), []);
}

function useBackgroundContext<T>(context: { __?: T; _defaultValue?: T; __c?: string }): T {
  const provider = context.__c && currentComponent?.context
    ? currentComponent.context[context.__c] as { props?: { value?: T } } | undefined
    : undefined;
  return provider?.props?.value ?? context.__ ?? context._defaultValue as T;
}

function useBackgroundId(): string {
  const hook = useBackgroundHook();
  if (!hook.value) {
    let root = currentVNode;
    while (root && !(root.__m ?? root._mask) && (root.__ ?? root._parent)) {
      root = (root.__ ?? root._parent) ?? undefined;
    }
    const mask = root
      ? (root.__m ??= root._mask ?? [0, 0])
      : [0, 0];
    hook.value = `P${mask[0]}-${mask[1]++}`;
  }
  return hook.value as string;
}

function useBackgroundEffect(): void {}

function currentHooks(): typeof mainThreadHooks {
  if (__MAIN_THREAD__) {
    mainThreadHooks.installMainThreadHooks();
    return mainThreadHooks;
  }
  return {
    useState: useBackgroundState,
    useReducer: useBackgroundReducer,
    useRef: useBackgroundRef,
    useImperativeHandle: useBackgroundEffect,
    useLayoutEffect: useBackgroundEffect,
    useEffect: useBackgroundEffect,
    useCallback: (callback: unknown, deps?: ReadonlyArray<unknown>) => useBackgroundMemo(() => callback, deps),
    useMemo: useBackgroundMemo,
    useContext: useBackgroundContext,
    useDebugValue: useBackgroundEffect,
    useErrorBoundary: () => [undefined, () => {}],
    useId: useBackgroundId,
    installMainThreadHooks: mainThreadHooks.installMainThreadHooks,
  } as typeof mainThreadHooks;
}

const useState =
  ((...args: unknown[]) =>
    (currentHooks().useState as (...args: unknown[]) => unknown)(...args)) as typeof mainThreadHooks.useState;
const useReducer =
  ((...args: unknown[]) =>
    (currentHooks().useReducer as (...args: unknown[]) => unknown)(...args)) as typeof mainThreadHooks.useReducer;
const useRef =
  ((...args: unknown[]) =>
    (currentHooks().useRef as (...args: unknown[]) => unknown)(...args)) as typeof mainThreadHooks.useRef;
const useImperativeHandle =
  ((...args: unknown[]) =>
    (currentHooks().useImperativeHandle as (...args: unknown[]) => unknown)(
      ...args,
    )) as typeof mainThreadHooks.useImperativeHandle;
const useLayoutEffect = ((...args: unknown[]) =>
  (currentHooks().useLayoutEffect as (...args: unknown[]) => unknown)(
    ...args,
  )) as typeof mainThreadHooks.useLayoutEffect;
const useEffect =
  ((...args: unknown[]) =>
    (currentHooks().useEffect as (...args: unknown[]) => unknown)(...args)) as typeof mainThreadHooks.useEffect;
const useCallback =
  ((...args: unknown[]) =>
    (currentHooks().useCallback as (...args: unknown[]) => unknown)(...args)) as typeof mainThreadHooks.useCallback;
const useMemo =
  ((...args: unknown[]) =>
    (currentHooks().useMemo as (...args: unknown[]) => unknown)(...args)) as typeof mainThreadHooks.useMemo;
const useContext =
  ((...args: unknown[]) =>
    (currentHooks().useContext as (...args: unknown[]) => unknown)(...args)) as typeof mainThreadHooks.useContext;
const useDebugValue =
  ((...args: unknown[]) =>
    (currentHooks().useDebugValue as (...args: unknown[]) => unknown)(...args)) as typeof mainThreadHooks.useDebugValue;
const useErrorBoundary = ((...args: unknown[]) =>
  (currentHooks().useErrorBoundary as (...args: unknown[]) => unknown)(
    ...args,
  )) as typeof mainThreadHooks.useErrorBoundary;
const useId =
  ((...args: unknown[]) =>
    (currentHooks().useId as (...args: unknown[]) => unknown)(...args)) as typeof mainThreadHooks.useId;

export {
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useErrorBoundary,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
};
