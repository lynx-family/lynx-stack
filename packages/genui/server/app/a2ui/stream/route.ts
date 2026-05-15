// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BASIC_CATALOG } from '../../../agent/a2ui-catalog';
import { validateA2UIOutput } from '../../../agent/a2ui-validator';
import { getA2UIAgentService } from '../../../service/a2ui-agent';
import type { ChatMessage } from '../../../service/a2ui-agent';
import { errorMessage, pickChatOptions } from '../_shared';
import type { A2UIChatBody } from '../_shared';
import { corsHeaders, corsPreflight, jsonWithCors } from '../cors';
import { checkRateLimit, rateLimitSseResponse } from '../rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      item !== null
      && typeof item === 'object'
      && typeof (item as ChatMessage).role === 'string'
      && typeof (item as ChatMessage).content === 'string',
  );
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

  let body: A2UIChatBody;
  try {
    body = (await req.json()) as A2UIChatBody;
  } catch {
    return jsonWithCors(
      req,
      { ok: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }

  if (!isChatMessageArray(body.messages)) {
    return jsonWithCors(
      req,
      { ok: false, error: 'messages is required' },
      { status: 400 },
    );
  }
  const messages = body.messages;
  const opts = pickChatOptions(body);
  const service = getA2UIAgentService();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        controller.enqueue(encodeSSE(event, data));
      };

      try {
        const { textStream, finalize } = await service.streamAsAsyncIterable(
          messages,
          opts,
        );

        enqueue('start', {
          threadId: opts.threadId,
          resourceId: opts.resourceId,
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
            opts.catalog ?? BASIC_CATALOG,
          );
          validation = {
            ok: v.ok,
            errors: v.errors,
            messages: v.ok ? v.messages : [],
          };
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
