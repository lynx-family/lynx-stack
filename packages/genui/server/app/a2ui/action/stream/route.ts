// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UICatalog } from '../../../../agent/a2ui-catalog';
import { BASIC_CATALOG } from '../../../../agent/a2ui-catalog';
import { validateA2UIOutput } from '../../../../agent/a2ui-validator';
import { getA2UIAgentService } from '../../../../service/a2ui-agent';
import type { ChatMessage } from '../../../../service/a2ui-agent';
import {
  MAX_MESSAGE_CHARS,
  errorMessage,
  pickChatOptions,
  readJsonBodyWithLimit,
} from '../../_shared';
import { corsHeaders, corsPreflight, jsonWithCors } from '../../cors';
import { checkRateLimit, rateLimitSseResponse } from '../../rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface A2UIActionStreamBody {
  threadId: string;
  surfaceId?: string;
  action: {
    name: string;
    context?: Record<string, unknown>;
  };
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
  reset?: boolean;
}

function encodeSSE(event: string, data: unknown): Uint8Array {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return new TextEncoder().encode(`event: ${event}\ndata: ${payload}\n\n`);
}

function sseHeaders(req: Request): Headers {
  return corsHeaders(req, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const decision = checkRateLimit(req);
  if (!decision.ok) {
    return rateLimitSseResponse(req, decision);
  }

  const parsed = await readJsonBodyWithLimit<A2UIActionStreamBody>(req);
  if (!parsed.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.body;

  if (!body || !body.threadId) {
    return jsonWithCors(
      req,
      { ok: false, error: 'threadId is required' },
      { status: 400 },
    );
  }
  if (!body.action || !body.action.name) {
    return jsonWithCors(
      req,
      { ok: false, error: 'action.name is required' },
      { status: 400 },
    );
  }

  const service = getA2UIAgentService();

  if (body.reset) {
    service.resetConversation(body.threadId);
  }

  const conv = service.peekConversation(body.threadId);
  if (!conv && !body.reset) {
    return jsonWithCors(req, {
      ok: false,
      error: `unknown threadId "${body.threadId}" - call /a2ui/chat first`,
    });
  }

  const payload = {
    surfaceId: body.surfaceId,
    action: body.action,
  };
  const userContent = `A2UI_USER_ACTION: ${JSON.stringify(payload)}`;
  if (userContent.length > MAX_MESSAGE_CHARS) {
    return jsonWithCors(
      req,
      {
        ok: false,
        error:
          `synthesized user action exceeds ${MAX_MESSAGE_CHARS} characters`,
      },
      { status: 413 },
    );
  }
  const userMessage: ChatMessage = {
    role: 'user',
    content: userContent,
  };

  const opts = pickChatOptions(body);
  const optsWithThread = { ...opts, threadId: body.threadId };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        controller.enqueue(encodeSSE(event, data));
      };

      try {
        const { textStream, finalize } = await service.streamAsAsyncIterable(
          [userMessage],
          optsWithThread,
        );

        enqueue('start', {
          threadId: body.threadId,
          actionName: body.action.name,
        });

        for await (const chunk of textStream) {
          enqueue('delta', { text: chunk });
        }

        const { text: finalText, usage, finishReason } = await finalize();

        let validation: { ok: boolean; errors: string[]; messages: unknown[] } =
          {
            ok: false,
            errors: ['no text produced'],
            messages: [],
          };
        if (finalText) {
          const v = validateA2UIOutput(
            finalText,
            optsWithThread.catalog ?? BASIC_CATALOG,
          );
          validation = {
            ok: v.ok,
            errors: v.errors,
            messages: v.ok ? v.messages : [],
          };
          if (v.ok && v.messages.length > 0) {
            service.recordStreamedConversation(
              body.threadId,
              [userMessage],
              finalText,
              v.messages,
            );
          }
        }

        enqueue('done', {
          text: finalText,
          usage,
          finishReason,
          validation,
        });
      } catch (err: unknown) {
        enqueue('error', errorMessage(err));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { status: 200, headers: sseHeaders(req) });
}
