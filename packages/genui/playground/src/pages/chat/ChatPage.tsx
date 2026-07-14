// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UI_CHAT_ADAPTER } from './a2ui.js';
import { ChatController } from './ChatController.js';
import { MCP_APPS_CHAT_ADAPTER } from './mcp-apps.js';
import { OPENUI_CHAT_ADAPTER } from './openui.js';
import type { Protocol } from '../../utils/protocol.js';

export interface ChatPageProps {
  protocol: Protocol;
  theme: 'light' | 'dark';
}

export function ChatPage(props: ChatPageProps) {
  if (props.protocol.name === 'mcp-apps') {
    return (
      <ChatController
        key='mcp-apps'
        {...props}
        adapter={MCP_APPS_CHAT_ADAPTER}
      />
    );
  }
  if (props.protocol.name === 'openui') {
    return (
      <ChatController
        key='openui'
        {...props}
        adapter={OPENUI_CHAT_ADAPTER}
      />
    );
  }

  return <ChatController key='a2ui' {...props} adapter={A2UI_CHAT_ADAPTER} />;
}
