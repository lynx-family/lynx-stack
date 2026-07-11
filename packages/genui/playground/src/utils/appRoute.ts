// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Protocol, ProtocolName } from './protocol.js';
import { DEFAULT_PROTOCOL, getProtocol } from './protocol.js';

export type Tab = 'create' | 'examples' | 'catalog' | 'bench';

export interface Route {
  protocol: Protocol;
  tab: Tab;
  componentName?: string;
  demoId?: string;
}

export const DEFAULT_ROUTE_HASH = '#/a2ui';

export function isEmptyRouteHash(hash: string): boolean {
  return hash === '' || hash === '#' || hash === '#/';
}

export function getRouteHash(hash: string): string {
  return isEmptyRouteHash(hash) ? DEFAULT_ROUTE_HASH : hash;
}

export function buildRouteHash(protocolName: ProtocolName, tab: Tab): string {
  return tab === 'create'
    ? `#/${protocolName}`
    : `#/${protocolName}/${tab}`;
}

export function parseRouteHash(hash: string): Route {
  const cleaned = getRouteHash(hash).replace(/^#\/?/u, '');
  const parts = cleaned.split('/');

  let protocol: Protocol = DEFAULT_PROTOCOL;
  let rest = parts;

  if (parts[0] === 'a2ui' || parts[0] === 'openui') {
    protocol = getProtocol(parts[0]);
    rest = parts.slice(1);
  }

  if (rest[0] === 'demos' || rest[0] === 'examples') {
    return {
      protocol,
      tab: 'examples',
      demoId: rest[1],
    };
  }
  if (rest[0] === 'components' || rest[0] === 'catalog') {
    return {
      protocol,
      tab: 'catalog',
      componentName: rest[1],
    };
  }
  if (rest[0] === 'chat' || rest[0] === 'create') {
    return { protocol, tab: 'create' };
  }
  if (rest[0] === 'bench' && protocol.name === 'a2ui') {
    return { protocol, tab: 'bench' };
  }
  // Back-compat: the standalone Playback tab is gone; route it to Examples.
  if (rest[0] === 'playback') {
    return { protocol, tab: 'examples' };
  }
  return { protocol, tab: 'create' };
}
