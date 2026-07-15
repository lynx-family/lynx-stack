// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type ProtocolName = 'a2ui' | 'openui' | 'mcp-apps';

export interface Protocol {
  name: ProtocolName;
  version: string;
}

export const PROTOCOLS: Record<ProtocolName, Protocol> = {
  a2ui: { name: 'a2ui', version: '0.9' },
  openui: { name: 'openui', version: '0.5' },
  'mcp-apps': { name: 'mcp-apps', version: '2026-01-26' },
};

export const DEFAULT_PROTOCOL: Protocol = PROTOCOLS.a2ui;

export function getProtocol(name: string | null | undefined): Protocol {
  if (name === 'openui') return PROTOCOLS.openui;
  if (name === 'mcp-apps') return PROTOCOLS['mcp-apps'];
  return PROTOCOLS.a2ui;
}
