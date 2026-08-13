// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { readModelConfig } from '../../../service/common/model-config.js';
import { jsonWithCors } from '../../common/cors';

function getA2UIHealth(req: Request) {
  const result = readModelConfig();
  if (!result.ok) {
    return jsonWithCors(req, {
      ok: false,
      provider: 'openai',
      hasKey: false,
      error: result.error,
    });
  }

  const { defaultModel, models } = result.config;
  const { apiKey } = models[defaultModel]!;

  return jsonWithCors(req, {
    ok: true,
    provider: 'openai',
    hasKey: Boolean(apiKey),
    modelName: defaultModel,
  });
}

const route = new Hono();

route.get('/', (context) => getA2UIHealth(context.req.raw));

export default route;
