// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ReactNode } from 'react';

import type { Protocol } from '../utils/protocol.js';

export interface PreviewQrItem {
  title: ReactNode;
  description: ReactNode;
  url?: string;
  urlTitle?: string;
  copyButtonTitle?: string;
  variant?: 'default' | 'alt';
  placeholder?: ReactNode;
  errorDescription?: ReactNode;
  showQrCode?: boolean;
}

interface A2UIPreviewSource {
  kind: 'a2ui';
  protocol: Protocol;
  demoUrl: string;
  theme: 'light' | 'dark';
  messages: unknown;
  messagesUrl?: string;
  actionMocks?: Record<string, unknown>;
  actionMocksUrl?: string;
  demoId?: string;
  liveAction?: boolean;
  playbackMode?: boolean;
}

interface OpenUIPreviewSource {
  kind: 'openui';
  rawText: string;
  theme?: 'light' | 'dark';
  liveAction?: boolean;
  playbackMode?: boolean;
}

export interface McpAppsPreviewSource {
  kind: 'mcp-apps';
  mcpAppData: unknown;
  theme?: 'light' | 'dark';
}

export interface LynxXmlPreviewSource {
  kind: 'lynx-xml';
  source: string;
  sourcePath?: string;
  theme?: 'light' | 'dark';
}

export interface HtmlPreviewSource {
  kind: 'html';
  source: string;
  theme?: 'light' | 'dark';
}

interface PlaceholderPreviewSource {
  kind: 'placeholder';
  item: PreviewQrItem;
}

export type PreviewPanelSource =
  | A2UIPreviewSource
  | OpenUIPreviewSource
  | McpAppsPreviewSource
  | LynxXmlPreviewSource
  | HtmlPreviewSource
  | PlaceholderPreviewSource;
