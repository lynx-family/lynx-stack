// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getA2UIAgentService } from '../../../service/a2ui-agent';
import { corsPreflight, jsonWithCors } from '../cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  let body: { threadId?: string };
  try {
    body = (await req.json()) as { threadId?: string };
  } catch {
    return jsonWithCors(
      req,
      { ok: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body?.threadId) {
    return jsonWithCors(req, { ok: false, error: 'threadId is required' });
  }

  getA2UIAgentService().resetConversation(body.threadId);
  return jsonWithCors(req, { ok: true });
}
