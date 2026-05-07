// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { IncomingMessage, ServerResponse } from 'node:http';

import { normalizeA2UIResult } from './a2uiNormalizer.js';
import { createClaudeCodeAdapter } from './claudeCodeAdapter.js';
import { resolveProvider } from './providerResolver.js';
import { createSessionManager } from './sessionManager.js';
import { closeSse, initSse, writeSseEvent } from './sse.js';
import type {
  AgentHealthResponse,
  AgentInterruptResponse,
  AgentSessionResponse,
} from './types.js';

type Next = () => void;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function isAgentPath(url: string): boolean {
  return url.startsWith('/__agent/');
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    req.on('error', reject);
  });
}

function getSessionIdFromRequest(req: IncomingMessage): string | null {
  const url = req.url;
  if (!url) {
    return null;
  }

  const parsed = new URL(url, 'http://localhost');
  const sessionId = parsed.searchParams.get('sessionId');
  return sessionId?.trim() ?? null;
}

function getTextFromRequest(req: IncomingMessage): string | null {
  const url = req.url;
  if (!url) {
    return null;
  }

  const parsed = new URL(url, 'http://localhost');
  const text = parsed.searchParams.get('text');
  return text?.trim() ?? null;
}

function handleHealth(res: ServerResponse): void {
  const resolved = resolveProvider();
  const response: AgentHealthResponse = {
    status: resolved.status,
    provider: resolved.provider,
    reason: resolved.reason,
    version: resolved.version,
    binaryPath: resolved.binaryPath,
    features: {
      streaming: true,
      interrupt: true,
      preview: true,
      tokenFallbackReserved: true,
    },
  };
  sendJson(res, 200, response);
}

function handleCreateSession(
  sessionManager: ReturnType<typeof createSessionManager>,
  res: ServerResponse,
): void {
  const session = sessionManager.createSession();
  const response: AgentSessionResponse = { sessionId: session.sessionId };
  sendJson(res, 200, response);
}

function handleChat(
  claudeCodeAdapter: ReturnType<typeof createClaudeCodeAdapter>,
  sessionManager: ReturnType<typeof createSessionManager>,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    sendJson(res, 400, { error: 'sessionId is required' });
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    sendJson(res, 404, { error: 'session not found' });
    return;
  }

  const text = getTextFromRequest(req);
  if (!text) {
    sendJson(res, 400, { error: 'text is required' });
    return;
  }

  const run = claudeCodeAdapter.prepareTextRun({
    prompt: text,
    cwd: process.cwd(),
    onStatus(payload) {
      if (!completed) {
        writeSseEvent(res, 'status', payload);
      }
    },
    onDelta(delta) {
      if (!completed && delta) {
        writeSseEvent(res, 'delta', {
          text: delta,
          sessionId,
          runId: runIdRef,
        });
      }
    },
    onDone(payload) {
      const normalizedA2UI = normalizeA2UIResult(payload.resultText);
      if (normalizedA2UI) {
        writeSseEvent(res, 'a2ui', normalizedA2UI);
      }
      finish('done', {
        sessionId,
        runId: runIdRef,
        resultText: payload.resultText,
      });
    },
    onError(error) {
      if (error instanceof Error) {
        finish('error', { message: error.message, sessionId, runId: runIdRef });
      } else {
        finish('error', { message: String(error), sessionId, runId: runIdRef });
      }
    },
  });
  const runIdRef = run.activeRun.runId;
  let completed = false;

  const finish = (event: 'done' | 'error', data: unknown) => {
    if (completed) {
      return false;
    }

    completed = true;
    sessionManager.clearActiveRun(sessionId, runIdRef);
    writeSseEvent(res, event, data);
    closeSse(res);
    return true;
  };

  const attached = sessionManager.attachActiveRun(sessionId, run.activeRun);
  if (!attached) {
    run.activeRun.stop();
    sendJson(res, 409, { error: 'session already has an active run' });
    return;
  }

  initSse(res);

  writeSseEvent(res, 'status', {
    phase: 'started',
    provider: 'claude_code',
    sessionId,
    runId: runIdRef,
  });

  run.start();
}

async function handleInterrupt(
  sessionManager: ReturnType<typeof createSessionManager>,
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const body = (await readJsonBody(req)) as { sessionId?: unknown };
    const sessionId = typeof body.sessionId === 'string'
      ? body.sessionId.trim()
      : '';

    if (!sessionId) {
      sendJson(res, 400, { error: 'sessionId is required' });
      return;
    }

    const response: AgentInterruptResponse = sessionManager.interruptSessionRun(
      sessionId,
    );
    const status = response.ok ? 200 : 404;
    sendJson(res, status, response);
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : 'bad request',
    });
  }
}

export function createAgentRunner() {
  const claudeCodeAdapter = createClaudeCodeAdapter();
  const sessionManager = createSessionManager();
  return {
    async handleRequest(
      req: IncomingMessage,
      res: ServerResponse,
      next: Next,
    ): Promise<void> {
      const url = req.url ?? '';
      if (!isAgentPath(url)) {
        next();
        return;
      }

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.end();
        return;
      }

      if (req.method === 'GET' && url.startsWith('/__agent/health')) {
        handleHealth(res);
        return;
      }

      if (req.method === 'POST' && url.startsWith('/__agent/session')) {
        handleCreateSession(sessionManager, res);
        return;
      }

      if (req.method === 'GET' && url.startsWith('/__agent/chat')) {
        handleChat(claudeCodeAdapter, sessionManager, req, res);
        return;
      }

      if (req.method === 'POST' && url.startsWith('/__agent/interrupt')) {
        await handleInterrupt(sessionManager, req, res);
        return;
      }

      sendJson(res, 404, { error: 'agent route not found' });
    },
  };
}
