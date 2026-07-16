// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { MCP_APPS_PROTOCOL_METADATA } from '@lynx-js/genui-mcp-apps/protocol';

import { corsPreflight, jsonWithCors } from '../../common/cors';

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export function GET(req: Request) {
  return jsonWithCors(req, MCP_APPS_PROTOCOL_METADATA, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
}
