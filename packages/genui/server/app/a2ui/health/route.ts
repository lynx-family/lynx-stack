// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { isOfficialOpenAIBaseURL } from '../../../agent/openai-utils';
import { jsonWithCors } from '../../common/cors';

function getA2UIHealth(req: Request) {
  const {
    OPENAI_API_KEY,
    OPENAI_API_STYLE,
    OPENAI_BASE_URL,
    OPENAI_MODEL,
  } = process.env;
  const hasKey = !!OPENAI_API_KEY;
  const baseURL = OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const isOfficial = isOfficialOpenAIBaseURL(baseURL);
  const api = (OPENAI_API_STYLE as 'chat' | 'responses' | undefined)
    ?? (isOfficial ? 'responses' : 'chat');

  return jsonWithCors(req, {
    ok: hasKey,
    provider: 'openai',
    hasKey,
    baseURL,
    model: OPENAI_MODEL ?? 'gpt-4o-mini',
    api,
  });
}

const route = new Hono();

route.get('/', (context) => getA2UIHealth(context.req.raw));

export default route;
