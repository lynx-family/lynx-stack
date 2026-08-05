// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { validateLynxXml } from '@lynx-js/genui-lynx-xml';

import { publishLynxXmlSource } from '../../a2ui/payload-publisher';
import { corsPreflight, jsonWithCors } from '../../common/cors';
import { errorMessage } from '../../common/errors';
import { checkRateLimit, rateLimitJsonResponse } from '../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../common/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LynxXmlPayloadBody {
  source?: unknown;
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const decision = checkRateLimit(req);
  if (!decision.ok) return rateLimitJsonResponse(req, decision);

  const parsed = await readJsonBodyWithLimit<LynxXmlPayloadBody>(req);
  if (!parsed.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }
  if (typeof parsed.body.source !== 'string') {
    return jsonWithCors(
      req,
      { ok: false, error: 'source is required' },
      { status: 400 },
    );
  }

  const validation = validateLynxXml(parsed.body.source);
  if (!validation.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validation.errors.join('; ') },
      { status: 400 },
    );
  }

  try {
    const preview = await publishLynxXmlSource(validation.source);
    if (!preview) {
      return jsonWithCors(
        req,
        { ok: false, error: 'payload publishing is not configured' },
        { status: 503 },
      );
    }
    return jsonWithCors(req, { ok: true, preview });
  } catch (error) {
    return jsonWithCors(
      req,
      { ok: false, error: errorMessage(error).message },
      { status: 500 },
    );
  }
}
