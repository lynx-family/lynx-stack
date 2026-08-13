// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { readModelConfig } from '../../service/common/model-config.js';
import { jsonWithCors } from '../common/cors.js';

function getModels(req: Request) {
  const result = readModelConfig();
  if (!result.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: result.error },
      { status: 503 },
    );
  }

  return jsonWithCors(req, {
    defaultModel: result.config.defaultModel,
    models: Object.keys(result.config.models).map((name) => ({
      id: name,
      label: name,
    })),
  });
}

const route = new Hono();

route.get('/', (context) => getModels(context.req.raw));

export default route;
