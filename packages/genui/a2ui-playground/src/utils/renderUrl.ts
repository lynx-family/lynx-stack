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
}

export function buildRenderUrl(init: RenderInit, baseUrl: string): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', init.protocol);
  url.searchParams.set('demoUrl', init.demoUrl);
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

  return url.toString();
}
