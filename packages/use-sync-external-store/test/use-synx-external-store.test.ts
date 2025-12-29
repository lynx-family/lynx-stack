// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Copyright 2025 (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Component, createElement, Fragment, memo } from '@lynx-js/react';
import type { PropsWithChildren } from '@lynx-js/react';
import { render, act } from '@lynx-js/react/testing-library';

import { useSyncExternalStoreWithSelector } from '../with-selector.js';

// This tests shared behavior between the built-in and shim implementations of
// of useSyncExternalStore.
describe('useSyncExternalStoreWithSelector', () => {
  const log = vi.fn();
  function assertLog(expected: string[]) {
    expect(log.mock.calls.map(args => args.join(' '))).toStrictEqual(expected);
    log.mockClear();
  }
  beforeEach(() => {
    log.mockClear();
  });

  function Text({ text }: { text: string }) {
    log(text);
    return text;
  }

  function createExternalStore<State>(initialState: State) {
    const listeners = new Set<() => void>();
    let currentState = initialState;
    return {
      set(text: State) {
        currentState = text;
        listeners.forEach(listener => listener());
      },
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getState() {
        return currentState;
      },
      getSubscriberCount() {
        return listeners.size;
      },
    };
  }

  describe('extra features implemented in user-space', () => {
    it('memoized selectors are only called once per update', async () => {
      const store = createExternalStore({
        a: 0,
        b: 0,
      });
      function selector(state: { a: number; b: number }) {
        log('Selector');
        return state.a;
      }
      function App() {
        log('App');
        const a = useSyncExternalStoreWithSelector(
          store.subscribe,
          store.getState,
          null,
          selector,
        );
        return createElement(Text, {
          text: 'A' + a,
        });
      }
      const { container } = render(createElement(App, null));
      assertLog(['App', 'Selector', 'A0']);
      expect(container.textContent).toEqual('A0');

      // Update the store
      act(() =>
        store.set({
          a: 1,
          b: 0,
        })
      );
      assertLog([
        // The selector runs before React starts rendering
        'Selector',
        'App',
        // And because the selector didn't change during render, we can reuse
        // the previous result without running the selector again
        'A1',
      ]);
      expect(container.textContent).toEqual('A1');
    });

    it('Using isEqual to bailout', async () => {
      const store = createExternalStore({
        a: 0,
        b: 0,
      });
      function A() {
        const { a } = useSyncExternalStoreWithSelector(
          store.subscribe,
          store.getState,
          null,
          state => ({
            a: state.a,
          }),
          (state1, state2) => state1.a === state2.a,
        );
        return createElement(Text, {
          text: 'A' + a,
        });
      }
      function B() {
        const { b } = useSyncExternalStoreWithSelector(
          store.subscribe,
          store.getState,
          null,
          state => {
            return {
              b: state.b,
            };
          },
          (state1, state2) => state1.b === state2.b,
        );
        return createElement(Text, {
          text: 'B' + b,
        });
      }
      function App() {
        return createElement(
          Fragment,
          null,
          createElement(A, null),
          createElement(B, null),
        );
      }
      const { container } = render(createElement(App, null));
      assertLog(['A0', 'B0']);
      expect(container.textContent).toEqual('A0B0');

      // Update b but not a
      act(() =>
        store.set({
          a: 0,
          b: 1,
        })
      );
      // Only b re-renders
      assertLog(['B1']);
      expect(container.textContent).toEqual('A0B1');

      // Update a but not b
      act(() =>
        store.set({
          a: 1,
          b: 1,
        })
      );
      // Only a re-renders
      assertLog(['A1']);
      expect(container.textContent).toEqual('A1B1');
    });
  });

  it('compares selection to rendered selection even if selector changes', async () => {
    interface State {
      items: string[];
    }

    const store = createExternalStore<State>({
      items: ['A', 'B'],
    });
    const shallowEqualArray = <T>(a: T[], b: T[]) => {
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    };
    const List = memo(({ items }: { items: string[] }) => {
      return createElement(
        Fragment,
        null,
        items.map(text =>
          createElement(Text, {
            key: text,
            text: text,
          })
        ),
      );
    });
    function App({ step }: { step: number }) {
      const inlineSelector = (state: State) => {
        log('Inline selector');
        return [...state.items, 'C'];
      };
      const items = useSyncExternalStoreWithSelector(
        store.subscribe,
        store.getState,
        null,
        inlineSelector,
        shallowEqualArray,
      );
      return createElement(
        Fragment,
        null,
        createElement(List, {
          items: items,
        }),
        createElement(Text, {
          text: 'Sibling: ' + step,
        }),
      );
    }
    act(() => {
      render(createElement(App, {
        step: 0,
      }));
    });
    assertLog(['Inline selector', 'A', 'B', 'C', 'Sibling: 0']);
    act(() => {
      render(
        createElement(App, {
          step: 1,
        }),
      );
    });
    assertLog([
      // We had to call the selector again because it's not memoized
      'Inline selector',
      // But because the result was the same (according to isEqual) we can
      // bail out of rendering the memoized list. These are skipped:
      // 'A',
      // 'B',
      // 'C',

      'Sibling: 1',
    ]);
  });

  describe('selector and isEqual error handling in extra', () => {
    let ErrorBoundary: typeof Component;
    beforeEach(() => {
      ErrorBoundary = class
        extends Component<PropsWithChildren<{}>, { error: Error | null }>
      {
        override state: { error: Error | null } = {
          error: null,
        };
        static getDerivedStateFromError(error: Error) {
          return {
            error,
          };
        }
        override render() {
          if (this.state.error) {
            return createElement(Text, {
              text: this.state.error.message,
            });
          }
          return this.props.children;
        }
      };
    });
    it('selector can throw on update', async () => {
      interface State {
        a: string;
      }
      const store = createExternalStore({
        a: 'a',
      });
      const selector = (state: State) => {
        if (typeof state.a !== 'string') {
          throw new TypeError('Malformed state');
        }
        return state.a.toUpperCase();
      };
      function App() {
        const a = useSyncExternalStoreWithSelector(
          store.subscribe,
          store.getState,
          null,
          selector,
        );
        return createElement(Text, {
          text: a,
        });
      }
      const { container } = render(
        createElement(
          ErrorBoundary,
          null,
          createElement(App, null),
        ),
      );

      assertLog(['A']);
      expect(container.textContent).toEqual('A');
      // @ts-expect-error testing error
      act(() => store.set({}));
      expect(container.textContent).toEqual('Malformed state');
    });

    it('isEqual can throw on update', async () => {
      interface State {
        a: string;
      }

      const store = createExternalStore<State>({
        a: 'A',
      });
      const selector = (state: State) => state;
      const isEqual = (left: State, right: State) => {
        if (typeof left.a !== 'string' || typeof right.a !== 'string') {
          throw new TypeError('Malformed state');
        }
        return left.a.trim() === right.a.trim();
      };
      function App() {
        const { a } = useSyncExternalStoreWithSelector(
          store.subscribe,
          store.getState,
          null,
          selector,
          isEqual,
        );
        return createElement(Text, {
          text: a,
        });
      }
      const { container } = render(
        createElement(
          ErrorBoundary,
          null,
          createElement(App, null),
        ),
      );

      assertLog(['A']);
      expect(container.textContent).toEqual('A');
      // @ts-expect-error testing error
      act(() => store.set({}));
      expect(container.textContent).toEqual('Malformed state');
    });
  });
});
