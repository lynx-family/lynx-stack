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

  const allowComposition = ['a2ui', 'openui'].includes(
    new URL(req.url).searchParams.get('protocol') ?? '',
  );
  const names = Object.keys(result.config.models).filter(name =>
    allowComposition || result.config.models[name]!.provider !== 'typesafe'
  );
  if (names.length === 0) {
    return jsonWithCors(req, {
      ok: false,
      error: 'No generation models are configured for this page.',
    }, { status: 503 });
  }
  return jsonWithCors(req, {
    defaultModel: names.includes(result.config.defaultModel)
      ? result.config.defaultModel
      : names[0],
    models: names.map((name) => ({
      id: name,
      label: name,
      ...(result.config.models[name]!.provider === 'typesafe'
        ? { composition: true }
        : {}),
      input_price: result.config.models[name]!.input_price,
      cached_price: result.config.models[name]!.cached_price,
      output_price: result.config.models[name]!.output_price,
    })),
  });
}

const route = new Hono();

route.get('/', (context) => getModels(context.req.raw));

export default route;
