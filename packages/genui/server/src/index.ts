// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { IncomingMessage, ServerResponse } from 'node:http';

import { handleNodeRequest } from './node-server';

export async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  await handleNodeRequest(request, response);
}
