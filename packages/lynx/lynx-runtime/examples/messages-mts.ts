// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Unsubscribe } from '@lynx-js/lynx-runtime';
import {
  flushElementTree,
  onDestroy,
  onMessage,
  sendMessage,
} from '@lynx-js/lynx-runtime/mts';

/** The paired BTS sender uses an object payload with a string text field. */
export function startMessageReceiver(
  applyText: (text: string) => void,
): Unsubscribe {
  const stopMessage = onMessage<{ text: string }>(
    'example:input',
    ({ text }) => {
      applyText(text);
      flushElementTree();
      // This reply confirms submission, not layout or paint completion.
      sendMessage('example:submitted', { text });
    },
  );
  const stopDestroy = onDestroy(dispose);

  function dispose(): void {
    stopMessage();
    stopDestroy();
  }

  return dispose;
}
