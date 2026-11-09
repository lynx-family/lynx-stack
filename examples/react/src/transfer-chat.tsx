// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState } from '@lynx-js/react';
import { TransferRegistry } from '@lynx-js/react-transfer';
import { transferDiagnostics } from '@lynx-js/react-transfer/experimental/diagnostics';

import './transfer-chat.css';

export function ChatBubble(props: Record<string, unknown>) {
  transferDiagnostics.recordRender();
  const [count, setCount] = useState(0);
  const user = props['role'] === 'user';
  const text = typeof props['text'] === 'string' ? props['text'] : '';
  return (
    <view
      className={`chat-bubble ${user ? 'chat-user' : 'chat-assistant'}`}
      bindtap={() => setCount(value => value + 1)}
    >
      <text className='chat-text'>{text}</text>
      <text className='chat-counter'>
        Count: {count} (+1)
      </text>
    </view>
  );
}

TransferRegistry.registerComponent('ChatBubble', () => ChatBubble);

// Read-only diagnostic data for the simulator validation, not a protocol entry.
(globalThis as unknown as {
  transferChatDebug: typeof transferDiagnostics.debug;
})
  .transferChatDebug = transferDiagnostics.debug;
