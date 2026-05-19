// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { encodeBase64Url } from './base64url.js';
import type { Protocol } from './protocol.js';

export interface RenderInit {
  protocol: Protocol;
  demoUrl: string;
  messages: unknown;
  actionMocks?: unknown;
  /** Theme forwarded to the preview runtime. */
  theme?: 'light' | 'dark';
  /** When set, use a short `?demo=<id>` param instead of inlining the payload. */
  demoId?: string;
  /** Simulation speed multiplier (e.g. 0.5, 1, 2, 4). */
  speed?: number;
  /** When true, render the final UI immediately without streaming playback. */
  instant?: boolean;
  /** When true, actions in the preview are forwarded to the parent frame for live agent handling. */
  liveAction?: boolean;
}

export function buildRenderUrl(init: RenderInit, baseUrl: string): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', init.protocol.name);
  url.searchParams.set('demoUrl', init.demoUrl);
  if (init.theme) {
    url.searchParams.set('theme', init.theme);
  }

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

  if (init.instant) {
    url.searchParams.set('instant', '1');
  }

  if (init.liveAction) {
    url.searchParams.set('liveAction', '1');
  }

  return url.toString();
}
