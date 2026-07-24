// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { corsPreflight, jsonWithCors } from '../../common/cors';
import { errorMessage } from '../../common/errors';
import { checkRateLimit, rateLimitJsonResponse } from '../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../common/request';
import { publishA2UIPayload } from '../payload-publisher';

interface A2UIPayloadBody {
  messages?: unknown;
  actionMocks?: unknown;
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const decision = checkRateLimit(req);
  if (!decision.ok) {
    return rateLimitJsonResponse(req, decision);
  }

  const parsed = await readJsonBodyWithLimit<A2UIPayloadBody>(req);
  if (!parsed.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }

  if (parsed.body.messages === undefined) {
    return jsonWithCors(
      req,
      { ok: false, error: 'messages is required' },
      { status: 400 },
    );
  }

  try {
    const preview = await publishA2UIPayload(
      parsed.body.messages,
      parsed.body.actionMocks,
    );
    if (!preview) {
      return jsonWithCors(
        req,
        { ok: false, error: 'payload publishing is not configured' },
        { status: 503 },
      );
    }

    return jsonWithCors(req, { ok: true, preview });
  } catch (err) {
    return jsonWithCors(
      req,
      { ok: false, error: errorMessage(err).message },
      { status: 500 },
    );
  }
}
