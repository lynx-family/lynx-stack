// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { jsonWithCors } from '../../common/cors';
import { errorMessage } from '../../common/errors';
import { checkRateLimit, rateLimitJsonResponse } from '../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../common/request';
import {
  isTosStorageMethod,
  isTosStorageType,
  publishA2UIPayload,
} from '../payload-publisher';
import type { TosStorageLocation } from '../payload-publisher';

interface A2UIPayloadBody {
  messages?: unknown;
  actionMocks?: unknown;
  method?: unknown;
  type?: unknown;
}

function isConversationMessage(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const message = value as Record<string, unknown>;
  return (
    (message.role === 'user'
      || message.role === 'assistant'
      || message.role === 'system')
    && typeof message.content === 'string'
  );
}

function parseStorageLocation(
  body: A2UIPayloadBody,
): { ok: true; location: TosStorageLocation } | { ok: false; error: string } {
  const messageRecord = body.messages !== null
      && typeof body.messages === 'object'
      && !Array.isArray(body.messages)
    ? body.messages as Record<string, unknown>
    : undefined;
  const isConversation = messageRecord?.kind === 'a2ui-conversation';

  if (isConversation) {
    if (
      messageRecord.v !== 1
      || !Array.isArray(messageRecord.messages)
      || !messageRecord.messages.every(message =>
        isConversationMessage(message)
      )
    ) {
      return { ok: false, error: 'invalid shared conversation payload' };
    }
    const protocol = messageRecord.protocol ?? 'a2ui';
    if (!isTosStorageMethod(protocol)) {
      return {
        ok: false,
        error: 'conversation protocol must be one of: a2ui, openui, mcp-apps',
      };
    }
    if (body.method !== undefined && body.method !== protocol) {
      return {
        ok: false,
        error: 'method must match the conversation protocol',
      };
    }
    if (body.type !== undefined && body.type !== 'conversation') {
      return {
        ok: false,
        error: 'shared conversation payloads must use type conversation',
      };
    }
    if (body.actionMocks !== undefined) {
      return {
        ok: false,
        error: 'shared conversation payloads must not include actionMocks',
      };
    }
    return {
      ok: true,
      location: { method: protocol, type: 'conversation' },
    };
  }

  const method = body.method ?? 'a2ui';
  if (!isTosStorageMethod(method)) {
    return {
      ok: false,
      error: 'method must be one of: a2ui, openui, mcp-apps',
    };
  }

  const type = body.type ?? 'preview';
  if (!isTosStorageType(type)) {
    return {
      ok: false,
      error: 'type must be one of: preview, conversation',
    };
  }

  if (type === 'conversation') {
    return {
      ok: false,
      error: 'conversation payloads must use kind a2ui-conversation',
    };
  }

  if (method !== 'a2ui') {
    return {
      ok: false,
      error: 'A2UI preview payloads must use method a2ui',
    };
  }

  return { ok: true, location: { method, type } };
}

async function postA2UIPayload(req: Request) {
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

  const storage = parseStorageLocation(parsed.body);
  if (!storage.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: storage.error },
      { status: 400 },
    );
  }

  try {
    const preview = await publishA2UIPayload(
      parsed.body.messages,
      parsed.body.actionMocks,
      storage.location,
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

const route = new Hono();

route.put('/', (context) => postA2UIPayload(context.req.raw));
// Keep POST working for clients deployed before the PUT upload contract.
route.post('/', (context) => postA2UIPayload(context.req.raw));

export default route;
