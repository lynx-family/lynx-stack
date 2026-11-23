// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { bindPage } from '../../src/bts.js';
import { onMessage, sendMessage } from '../../src/mts.js';

export function startCommunicationMainThread(
  commit: (value: number) => void,
): () => void {
  let value = 0;
  const stopMessage = onMessage<number>('counter:add', amount => {
    value += amount;
    sendMessage('counter:value', value);
  });
  const stopReplace = onMessage<{ value: number }>(
    'counter:replace',
    data => {
      value = data.value;
      commit(value);
    },
  );
  return () => {
    stopMessage();
    stopReplace();
  };
}

export function startCommunicationBackground(
  render: (value: number) => void,
) {
  const page = bindPage();
  page.onMessage<number>('counter:value', render);
  return {
    add(amount: number): void {
      page.sendMessage('counter:add', amount);
    },
    replace(value: number): void {
      page.sendMessage('counter:replace', { value });
    },
  };
}
