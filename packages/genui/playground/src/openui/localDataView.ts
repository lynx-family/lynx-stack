// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { openUIStorageKey, readOpenUILocalData } from './dataHost.js';
import type { ChatArtifactView } from '../pages/chat/type.js';

export function createOpenUILocalDataView(
  source: string,
  initial: Record<string, unknown> | (() => Record<string, unknown>),
): ChatArtifactView {
  const getInitial = () => typeof initial === 'function' ? initial() : initial;
  const key = openUIStorageKey(source);
  const getSnapshot = () => {
    try {
      return JSON.stringify(
        readOpenUILocalData(source, getInitial(), window.localStorage),
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        { error: error instanceof Error ? error.message : String(error) },
        null,
        2,
      );
    }
  };
  return {
    id: 'local-data',
    label: 'Local data',
    language: 'json',
    get text() {
      return getSnapshot();
    },
    liveText: {
      getSnapshot,
      subscribe: onChange => {
        // Mutations run in the same-origin render iframe. Native storage events
        // reach this parent window and also cover edits in other preview tabs.
        const onStorage = (event: StorageEvent) => {
          if (
            (event.key === key || event.key === null)
            && event.storageArea === window.localStorage
          ) onChange();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
      },
    },
  };
}
