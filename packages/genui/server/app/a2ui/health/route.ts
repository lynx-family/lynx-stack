// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isOfficialOpenAIBaseURL } from '../../../agent/openai-utils';
import { corsPreflight, jsonWithCors } from '../../common/cors';

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export function GET(req: Request) {
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
