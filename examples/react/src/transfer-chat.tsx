// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createTransferRenderContext } from '@lynx-js/react/internal';

import './transfer-chat.css';

// Delay only ownership handoff, so the real native first frame is observable.
const transfers = createTransferRenderContext({ hydrationDelayMs: 800 });

export function ChatBubble(props: Record<string, unknown>) {
  transfers.recordRender();
  const user = props['role'] === 'user';
  const text = typeof props['text'] === 'string' ? props['text'] : '';
  return (
    <view className={`chat-bubble ${user ? 'chat-user' : 'chat-assistant'}`}>
      <text className='chat-text'>{text}</text>
    </view>
  );
}

transfers.registerComponent('ChatBubble', () => ChatBubble);

// Read-only diagnostic data for the simulator validation, not a protocol entry.
(globalThis as unknown as { transferChatDebug: typeof transfers.debug })
  .transferChatDebug = transfers.debug;
