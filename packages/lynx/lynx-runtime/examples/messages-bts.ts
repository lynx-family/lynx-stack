// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { bindPage } from '@lynx-js/lynx-runtime/bts';

interface MessageSender {
  send(text: string): void;
  dispose(): void;
}

/** Call send only after the MTS receiver and this BTS reply listener are installed. */
export function startMessageSender(
  recordSubmission: (text: string) => void,
): MessageSender {
  const page = bindPage();
  let active = true;
  const stopReply = page.onMessage<{ text: string }>(
    'example:submitted',
    ({ text }) => recordSubmission(text),
  );
  const stopDestroy = page.onDestroy(dispose);

  function dispose(): void {
    active = false;
    stopReply();
    stopDestroy();
  }

  return {
    send(text): void {
      if (!active || page.isDestroyed()) return;
      page.sendMessage('example:input', { text });
    },
    dispose,
  };
}
