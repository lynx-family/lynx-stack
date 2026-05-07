// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { encodeBase64Url } from './base64url.js';
import type { ProtocolVersion } from './protocol.js';

export interface RenderInit {
  protocol: ProtocolVersion;
  demoUrl: string;
  messages: unknown;
  actionMocks?: unknown;
  /** When set, use a short `?demo=<id>` param instead of inlining the payload. */
  demoId?: string;
  /** Simulation speed multiplier (e.g. 0.5, 1, 2, 4). */
  speed?: number;
}

export function buildRenderUrl(init: RenderInit, baseUrl: string): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', init.protocol);
  url.searchParams.set('demoUrl', init.demoUrl);

  if (init.demoId) {
    // Known demo: reference static JSON file by ID instead of inlining payload.
    url.searchParams.set('demo', init.demoId);
  } else {
    // Custom JSON: inline the payload as base64url.
    url.searchParams.set(
      'messages',
      encodeBase64Url(JSON.stringify(init.messages)),
    );

    if (init.actionMocks !== undefined) {
      url.searchParams.set(
        'actionMocks',
        encodeBase64Url(JSON.stringify(init.actionMocks)),
      );
    }
  }

  if (init.speed !== undefined && init.speed !== 1) {
    url.searchParams.set('speed', String(init.speed));
  }

  return url.toString();
}
