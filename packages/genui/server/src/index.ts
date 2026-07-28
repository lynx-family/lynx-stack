// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { HttpRequest, HttpResponse } from './node-handler';
import { handleNodeRequest } from './node-handler';

export async function handler(
  request: HttpRequest,
  response: HttpResponse,
): Promise<void> {
  await handleNodeRequest(request, response);
}
