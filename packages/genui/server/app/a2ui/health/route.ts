// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { readArkImageGenerationConfig } from '../../../agent/ark-image-generation-tool.js';
import { readDoubaoSearchConfig } from '../../../agent/doubao-search-tool.js';
import { readModelConfig } from '../../../service/common/model-config.js';
import { jsonWithCors } from '../../common/cors';

function getA2UIHealth(req: Request) {
  const search = readDoubaoSearchConfig();
  const webSearchReady = search.ok && search.enabled;
  const imageSearchReady = webSearchReady;
  const result = readModelConfig();
  if (!result.ok) {
    return jsonWithCors(req, {
      ok: false,
      provider: 'openai',
      hasKey: false,
      imageSearchReady,
      webSearchReady,
      error: result.error,
    });
  }

  const { defaultModel, models } = result.config;
  const { apiKey } = models[defaultModel]!;
  const imageGeneration = readArkImageGenerationConfig();
  if (!imageGeneration.ok) {
    return jsonWithCors(req, {
      ok: false,
      provider: 'openai',
      hasKey: Boolean(apiKey),
      modelName: defaultModel,
      imageGenerationReady: false,
      imageSearchReady,
      webSearchReady,
      error: imageGeneration.error,
    });
  }

  return jsonWithCors(req, {
    ok: true,
    provider: 'openai',
    hasKey: Boolean(apiKey),
    modelName: defaultModel,
    imageGenerationReady: true,
    imageSearchReady,
    webSearchReady,
  });
}

const route = new Hono();

route.get('/', (context) => getA2UIHealth(context.req.raw));

export default route;
