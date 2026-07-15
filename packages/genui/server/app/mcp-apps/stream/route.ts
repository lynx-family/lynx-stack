// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { MCP_APPS_PROTOCOL_VERSION } from '@lynx-js/genui-mcp-apps/protocol';

import {
  buildMcpAppsRegistrySystemMessage,
  parseMcpAppsAgentOutputs,
  resolveMcpAppsResource,
  validateMcpAppsClientRegistry,
} from '../../../agent/mcp-apps-registry';
import { getMcpAppsAgentService } from '../../../service/mcp-apps-agent';
import {
  validateConversation,
  validateMessages,
} from '../../common/chat-validation';
import { corsPreflight, jsonWithCors } from '../../common/cors';
import { errorMessage } from '../../common/errors';
import { pickProviderOptions } from '../../common/provider-options';
import { checkRateLimit, rateLimitSseResponse } from '../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../common/request';
import { encodeSSE, sseHeaders } from '../../common/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface McpAppsChatBody {
  messages?: unknown;
  conversation?: unknown;
  registry?: unknown;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  api?: 'chat' | 'responses';
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const decision = checkRateLimit(req);
  if (!decision.ok) return rateLimitSseResponse(req, decision);

  const parsed = await readJsonBodyWithLimit<McpAppsChatBody>(req);
  if (!parsed.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }
  const validatedMessages = validateMessages(parsed.body.messages);
  if (!validatedMessages.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validatedMessages.error },
      { status: validatedMessages.status },
    );
  }
  const validatedConversation = validateConversation(parsed.body.conversation);
  if (!validatedConversation.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validatedConversation.error },
      { status: validatedConversation.status },
    );
  }
  const validatedRegistry = validateMcpAppsClientRegistry(parsed.body.registry);
  if (!validatedRegistry.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: validatedRegistry.error },
      { status: validatedRegistry.status },
    );
  }

  const registry = validatedRegistry.registry;
  const opts = pickProviderOptions(parsed.body);
  const service = getMcpAppsAgentService();
  const modelMessages = [
    {
      role: 'system' as const,
      content: buildMcpAppsRegistrySystemMessage(registry),
    },
    ...validatedMessages.messages,
  ];

  let closed = false;
  const generationController = new AbortController();
  const abortGeneration = (reason?: unknown) => {
    if (!generationController.signal.aborted) {
      generationController.abort(reason);
    }
  };
  const onRequestAbort = () => abortGeneration(req.signal.reason);
  if (req.signal.aborted) {
    onRequestAbort();
  } else {
    req.signal.addEventListener('abort', onRequestAbort, { once: true });
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (event: string, data: unknown) => {
        if (closed) return false;
        try {
          controller.enqueue(encodeSSE(event, data));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };
      const run = async () => {
        try {
          const { text, usage, finishReason } = await service.generateRaw(
            modelMessages,
            opts,
            validatedConversation.conversation,
            generationController.signal,
          );
          const selection = parseMcpAppsAgentOutputs(
            text,
            '',
            registry,
          );
          if (selection.type === 'message') {
            enqueue('done', {
              ok: true,
              protocolVersion: MCP_APPS_PROTOCOL_VERSION,
              message: selection.text,
              usage,
              finishReason,
            });
            return;
          }

          const tool = registry.tools.find((item) =>
            item.name === selection.name
          );
          if (!tool) {
            throw new Error(`registered tool ${selection.name} is missing`);
          }
          const resource = resolveMcpAppsResource(tool, registry);
          enqueue('done', {
            ok: true,
            protocolVersion: MCP_APPS_PROTOCOL_VERSION,
            toolCall: {
              jsonrpc: '2.0',
              id: `mcp-apps-call-${crypto.randomUUID()}`,
              method: 'tools/call',
              params: {
                name: selection.name,
                arguments: selection.arguments,
              },
            },
            tool,
            resource,
            usage,
            finishReason,
          });
        } catch (error) {
          if (!closed && !generationController.signal.aborted) {
            enqueue('error', errorMessage(error));
          }
        } finally {
          req.signal.removeEventListener('abort', onRequestAbort);
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              // The reader may have canceled between the state check and close.
            }
          }
        }
      };
      void run();
    },
    cancel(reason) {
      closed = true;
      req.signal.removeEventListener('abort', onRequestAbort);
      abortGeneration(reason);
    },
  });

  return new Response(stream, { status: 200, headers: sseHeaders(req) });
}
