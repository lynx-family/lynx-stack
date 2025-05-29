// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable */

// This file is modified from `@types/use-sync-external-store`.
/**
 * @license
This project is licensed under the MIT license.
Copyrights are respective of each contributor listed at the beginning of each definition file.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { describe, test } from 'vitest';

import { useSyncExternalStore } from '@lynx-js/use-sync-external-store';
import { useSyncExternalStoreWithSelector } from '@lynx-js/use-sync-external-store/with-selector';

interface Store<State> {
  getState(): State;
  getServerState(): State;
  subscribe(onStoreChange: () => void): () => void;
}

declare const numberStore: Store<number>;
function useVersion(): number {
  return useSyncExternalStore(
    numberStore.subscribe,
    numberStore.getState,
    numberStore.getServerState,
  );
}

function useStoreWrong() {
  useSyncExternalStore(
    // no unsubscribe returned
    // @ts-expect-error
    () => {
      return null;
    },
    () => 1,
  );

  // `string` is not assignable to `number`
  // @ts-expect-error
  const version: number = useSyncExternalStore(
    () => () => {},
    () => '1',
  );
}

declare const objectStore: Store<
  { version: { major: number; minor: number }; users: string[] }
>;
function useUsers(): string[] {
  return useSyncExternalStore(
    objectStore.subscribe,
    () => objectStore.getState().users,
  );
}

function useReduxSelector<Selection>(
  selector: (
    state: { version: { major: number; minor: number }; users: string[] },
  ) => Selection,
): Selection {
  return useSyncExternalStoreWithSelector(
    objectStore.subscribe,
    objectStore.getState,
    objectStore.getServerState,
    selector,
  );
}
function useReduxUsers(): string[] {
  return useSyncExternalStoreWithSelector(
    objectStore.subscribe,
    objectStore.getState,
    objectStore.getServerState,
    state => state.users,
  );
}
function useReduxVersion(): { major: number; minor: number } {
  useSyncExternalStoreWithSelector(
    objectStore.subscribe,
    objectStore.getState,
    objectStore.getServerState,
    state => state.version,
    // `patch` does not exist on type `{ major: number, minor: number }`
    // @ts-expect-error
    (a, b) => a.patch === b.patch,
  );
  return useSyncExternalStoreWithSelector(
    objectStore.subscribe,
    objectStore.getState,
    objectStore.getServerState,
    state => state.version,
    (a, b) => a.minor === b.minor && a.major === b.major,
  );
}

describe('use-sync-external-store', () => {
  test('useSyncExternalStore', () => {
    useVersion();
    useStoreWrong();
  });
  test('useSyncExternalStoreWithSelector', () => {
    useUsers();
    useReduxSelector(state => state.users);
    useReduxUsers();
    useReduxVersion();
  });
});
