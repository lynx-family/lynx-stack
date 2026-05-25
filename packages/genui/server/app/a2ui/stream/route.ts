// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BASIC_CATALOG } from '../../../agent/a2ui-catalog';
import {
  A2UIProtocolMessageStreamParser,
  splitA2UIProtocolMessages,
} from '../../../agent/a2ui-stream-parser';
import { validateA2UIOutput } from '../../../agent/a2ui-validator';
import { resolveA2UIImageUrls } from '../../../agent/image-resolver';
import { getA2UIAgentService } from '../../../service/a2ui-agent';
import {
  errorMessage,
  pickChatOptions,
  readJsonBodyWithLimit,
  validateConversation,
  validateMessages,
} from '../_shared';
import type { A2UIChatBody } from '../_shared';
import { corsHeaders, corsPreflight, jsonWithCors } from '../cors';
import { checkRateLimit, rateLimitSseResponse } from '../rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const parsed = await readJsonBodyWithLimit<A2UIChatBody>(req);
  if (!parsed.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.body;

  const validated = validateMessages(body.messages);
  if (!validated.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validated.error },
      { status: validated.status },
    );
  }
  const messages = validated.messages;
  const validatedConversation = validateConversation(body.conversation);
  if (!validatedConversation.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validatedConversation.error },
      { status: validatedConversation.status },
    );
  }
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
          validatedConversation.conversation,
        );
        const protocolParser = new A2UIProtocolMessageStreamParser();
        const streamedMessages: unknown[] = [];
        let streamedText = '';

        for await (const chunk of textStream) {
          streamedText += chunk;
          enqueue('delta', { text: chunk });
          const newMessages = protocolParser.push(chunk);
          if (newMessages.length > 0) {
            streamedMessages.push(...newMessages);
            enqueue('message', { messages: streamedMessages });
          }
        }

        let { text: finalText, usage, finishReason } = await finalize();
        finalText ??= streamedText;
        let repair:
          | {
            attempted: true;
            sourceErrors: string[];
            ok: boolean;
            attempts: number;
            errors?: string[];
          }
          | undefined;

        let validation: { ok: boolean; errors: string[]; messages: unknown[] } =
          {
            ok: false,
            errors: ['no text produced'],
            messages: [],
          };
        const v = validateA2UIOutput(
          finalText ?? '',
          opts.catalog ?? BASIC_CATALOG,
        );
        let resolvedMessages = v.ok
          ? splitA2UIProtocolMessages(await resolveA2UIImageUrls(v.messages))
          : [];
        validation = {
          ok: v.ok,
          errors: v.errors,
          messages: resolvedMessages,
        };
        if (!v.ok) {
          try {
            const repaired = await service.generateValidated(
              messages,
              opts,
              validatedConversation.conversation,
            );
            repair = {
              attempted: true,
              sourceErrors: v.errors,
              ok: repaired.ok,
              attempts: repaired.attempts,
            };
            enqueue('repair', repair);
            if (repaired.ok) {
              finalText = repaired.text;
              usage = repaired.usage;
              finishReason = repaired.finishReason;
              resolvedMessages = splitA2UIProtocolMessages(
                await resolveA2UIImageUrls(repaired.messages),
              );
              validation = {
                ok: true,
                errors: [],
                messages: resolvedMessages,
              };
            } else {
              validation = {
                ok: false,
                errors: repaired.errors,
                messages: [],
              };
            }
          } catch (err: unknown) {
            const repairError = errorMessage(err).message;
            repair = {
              attempted: true,
              sourceErrors: v.errors,
              ok: false,
              attempts: 0,
              errors: [repairError],
            };
            validation = {
              ok: false,
              errors: [repairError],
              messages: [],
            };
            enqueue('repair', repair);
          }
        }

        enqueue('done', {
          text: finalText,
          usage,
          finishReason,
          validation,
          repair,
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
