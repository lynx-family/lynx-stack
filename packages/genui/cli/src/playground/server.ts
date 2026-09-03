// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import * as path from 'node:path';

import type { PlaygroundEngine } from './engine.js';
import type { PlaygroundStore } from './store.js';
import { PlaygroundError, requireUuid } from './types.js';
import type { AgentId, PlaygroundEvent, TurnRequest } from './types.js';

const BODY_LIMIT = 3 * 1024 * 1024;
const BOOTSTRAP_TTL_MS = 60_000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1_000;

interface Session {
  csrf: string;
  expiresAt: number;
}

export interface PlaygroundHttpOptions {
  port: number;
  /** Explicit test-only binding override; the isolated binding is 127.0.0.1. */
  previewHost?: string;
  /** Explicit test-only URL hostname; the isolated hostname is localhost. */
  previewPublicHost?: string;
  previewPort?: number;
  requireIsolatedPreview?: boolean;
  assetsRoot: string;
  store: PlaygroundStore;
  engine: PlaygroundEngine;
}

export interface PlaygroundHttp {
  readonly controlServer: Server;
  readonly previewServer: Server;
  readonly controlOrigin: string;
  readonly previewOrigin: string;
  readonly previewIsolation: PreviewIsolation;
  issueBootstrapUrl(): string;
  publish(conversationId: string, event: PlaygroundEvent): void;
  close(): Promise<void>;
}

export interface PreviewIsolation {
  status: 'isolated' | 'degraded';
  isolationCompliant: boolean;
  controlHost: '127.0.0.1';
  previewHost: string;
  controlBoundHost: '127.0.0.1';
  previewBoundHost: string;
  controlOrigin: string;
  previewOrigin: string;
  distinctPort: boolean;
  reason?: string;
}

export async function startPlaygroundHttp(
  options: PlaygroundHttpOptions,
): Promise<PlaygroundHttp> {
  const controlOrigin = `http://127.0.0.1:${options.port}`;
  const previewBoundHost = options.previewHost ?? '127.0.0.1';
  const previewHost = options.previewPublicHost
    ?? (options.previewHost === undefined ? 'localhost' : previewBoundHost);
  let previewPort = options.previewPort ?? 0;
  let previewOrigin = originFor(previewHost, previewPort);
  const previewIsolation = createPreviewIsolation(
    controlOrigin,
    previewOrigin,
    previewBoundHost,
    previewHost,
    options.previewPort === undefined || options.previewPort === 0,
  );
  const bootstraps = new Map<string, number>();
  const sessions = new Map<string, Session>();
  const subscribers = new Map<string, Set<ServerResponse>>();

  const publish = (conversationId: string, event: PlaygroundEvent): void => {
    const targets = subscribers.get(conversationId);
    if (!targets) return;
    const frame = encodeSse(event);
    publishSseFrame(targets, frame);
    if (targets.size === 0) subscribers.delete(conversationId);
  };

  const issueBootstrapUrl = (): string => {
    const token = randomBytes(32).toString('base64url');
    bootstraps.set(token, Date.now() + BOOTSTRAP_TTL_MS);
    return `${controlOrigin}/#bootstrap=${encodeURIComponent(token)}`;
  };

  const controlServer = createServer((request, response) => {
    void handleControlRequest({
      request,
      response,
      options,
      controlOrigin,
      previewOrigin,
      previewIsolation,
      bootstraps,
      sessions,
      subscribers,
    }).catch((error) => sendError(response, error));
  });
  const previewServer = createServer((request, response) => {
    try {
      handlePreviewRequest(
        request,
        response,
        previewHost,
        previewPort,
        options.assetsRoot,
        controlOrigin,
      );
    } catch (error) {
      sendError(response, error);
    }
  });

  await listen(controlServer, options.port, '127.0.0.1', 'control');
  try {
    await listen(previewServer, previewPort, previewBoundHost, 'preview');
    previewPort = serverPort(previewServer);
    previewOrigin = originFor(previewHost, previewPort);
  } catch (error) {
    await closeServer(controlServer);
    throw error;
  }
  Object.assign(
    previewIsolation,
    createPreviewIsolation(
      controlOrigin,
      previewOrigin,
      previewBoundHost,
      previewHost,
      options.previewPort === undefined || options.previewPort === 0,
    ),
  );
  if (options.requireIsolatedPreview && !previewIsolation.isolationCompliant) {
    await Promise.all([closeServer(controlServer), closeServer(previewServer)]);
    throw new Error(
      `Isolated preview contract requires control 127.0.0.1 and Preview localhost on an independent dynamic port: ${
        previewIsolation.reason ?? 'non-compliant binding'
      }`,
    );
  }

  return {
    controlServer,
    previewServer,
    controlOrigin,
    previewOrigin,
    previewIsolation,
    issueBootstrapUrl,
    publish,
    async close() {
      for (const targets of subscribers.values()) {
        for (const response of targets) response.end();
      }
      await Promise.all([
        closeServer(controlServer),
        closeServer(previewServer),
      ]);
    },
  };
}

interface ControlContext {
  request: IncomingMessage;
  response: ServerResponse;
  options: PlaygroundHttpOptions;
  controlOrigin: string;
  previewOrigin: string;
  previewIsolation: PreviewIsolation;
  bootstraps: Map<string, number>;
  sessions: Map<string, Session>;
  subscribers: Map<string, Set<ServerResponse>>;
}

async function handleControlRequest(context: ControlContext): Promise<void> {
  const { request, response, options, controlOrigin, previewOrigin } = context;
  enforceHost(request, `127.0.0.1:${options.port}`);
  const url = parseRequestUrl(request, controlOrigin);
  if (url.pathname === '/api/bootstrap' && request.method === 'POST') {
    enforceOrigin(request, controlOrigin);
    const body = await readJsonObject(request);
    if (typeof body['token'] !== 'string') {
      throw new PlaygroundError(400, 'Missing bootstrap token');
    }
    const expiresAt = context.bootstraps.get(body['token']);
    context.bootstraps.delete(body['token']);
    if (!expiresAt || expiresAt < Date.now()) {
      throw new PlaygroundError(401, 'Bootstrap URL is invalid or expired');
    }
    const sessionId = randomBytes(32).toString('base64url');
    const csrf = randomBytes(24).toString('base64url');
    context.sessions.set(sessionId, {
      csrf,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    response.setHeader(
      'Set-Cookie',
      `genui_session=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`,
    );
    sendJson(response, 200, {
      csrf,
      previewOrigin,
      previewIsolation: context.previewIsolation,
      dataRoot: options.store.dataRoot,
    });
    return;
  }
  if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
    if (request.headers.origin !== undefined) {
      enforceOrigin(request, controlOrigin);
    }
    const session = authenticate(request, context.sessions);
    sendJson(response, 200, {
      csrf: session.csrf,
      previewOrigin,
      previewIsolation: context.previewIsolation,
      dataRoot: options.store.dataRoot,
    });
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    const session = authenticate(request, context.sessions);
    if (isMutating(request.method)) {
      enforceOrigin(request, controlOrigin);
      if (request.headers['x-genui-csrf'] !== session.csrf) {
        throw new PlaygroundError(403, 'Invalid CSRF token');
      }
    } else if (request.headers.origin !== undefined) {
      enforceOrigin(request, controlOrigin);
    }
    await handleApi(context, url);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw new PlaygroundError(405, 'Method not allowed');
  }
  setControlSecurityHeaders(response, previewOrigin);
  serveStatic(
    response,
    options.assetsRoot,
    url.pathname === '/' ? '/index.html' : url.pathname,
    request.method === 'HEAD',
    'control',
  );
}

async function handleApi(context: ControlContext, url: URL): Promise<void> {
  const { request, response, options } = context;
  response.setHeader('Cache-Control', 'no-store');
  const segments = routeSegments(url.pathname);
  if (request.method === 'GET' && segments.join('/') === 'api/agents') {
    sendJson(response, 200, { agents: options.engine.descriptors() });
    return;
  }
  if (
    request.method === 'GET' && segments[0] === 'api'
    && segments[1] === 'agents' && segments[2] && segments[3] === 'models'
    && segments.length === 4
  ) {
    sendJson(
      response,
      200,
      await options.engine.modelCatalog(requireAgentId(segments[2])),
    );
    return;
  }
  if (request.method === 'GET' && segments.join('/') === 'api/conversations') {
    const limit = parseBoundedInteger(url.searchParams.get('limit'), 100, 200);
    const offset = parseBoundedInteger(
      url.searchParams.get('offset'),
      0,
      1_000_000,
    );
    const all = options.store.list();
    sendJson(response, 200, {
      conversations: all.slice(offset, offset + limit),
      nextOffset: offset + limit < all.length ? offset + limit : null,
      dataRoot: options.store.dataRoot,
      diskUsage: options.store.diskUsage(),
      warnings: options.store.recoveryWarnings,
    });
    return;
  }
  if (
    request.method === 'POST'
    && segments.join('/') === 'api/data-directory/open'
  ) {
    const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const child = spawn(command, [options.store.dataRoot], {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', () => {
      // The UI request is already accepted; folder opening is best effort.
    });
    child.unref();
    sendJson(response, 202, { opened: true });
    return;
  }
  if (
    segments[0] !== 'api' || segments[1] !== 'conversations' || !segments[2]
  ) {
    throw new PlaygroundError(404, 'API route not found');
  }
  const conversationId = requireUuid(segments[2], 'conversationId');

  if (segments.length === 3) {
    if (request.method === 'PUT') {
      const body = await readJsonObject(request);
      rejectUnknownKeys(body, ['title']);
      const result = options.store.putConversation(conversationId, body);
      sendJson(response, result.created ? 201 : 200, result);
      return;
    }
    if (request.method === 'GET') {
      const cursor = parseBoundedInteger(
        url.searchParams.get('cursor'),
        0,
        1_000_000,
      );
      const limit = parseBoundedInteger(
        url.searchParams.get('limit'),
        200,
        200,
      );
      sendJson(
        response,
        200,
        options.store.snapshot(
          conversationId,
          cursor,
          limit,
        ),
      );
      return;
    }
    if (request.method === 'PATCH') {
      const patch = await readJsonObject(request);
      rejectUnknownKeys(patch, ['title', 'archived']);
      sendJson(response, 200, {
        conversation: options.store.patchConversation(
          conversationId,
          patch,
        ),
      });
      return;
    }
  }

  if (
    segments[3] === 'sessions' && segments[4] && segments.length === 5
    && request.method === 'PUT'
  ) {
    const sessionId = requireUuid(segments[4], 'sessionId');
    const body = await readJsonObject(request);
    rejectUnknownKeys(body, ['agentId', 'model', 'effort']);
    const agentId = requireAgentId(body['agentId']);
    const result = options.store.putSession(conversationId, sessionId, {
      agentId,
      ...(typeof body['model'] === 'string'
        ? { model: body['model'].slice(0, 200) }
        : {}),
      ...(typeof body['effort'] === 'string'
        ? { effort: body['effort'].slice(0, 100) }
        : {}),
    });
    sendJson(response, result.created ? 201 : 200, result);
    return;
  }

  if (
    segments[3] === 'turns' && segments[4] && segments.length === 5
    && request.method === 'PUT'
  ) {
    const turnId = requireUuid(segments[4], 'turnId');
    const body = await readJsonObject(request);
    rejectUnknownKeys(body, [
      'sessionId',
      'prompt',
      'agentId',
      'model',
      'effort',
    ]);
    const turnRequest = parseTurnRequest(body);
    const result = await options.engine.submitTurn(
      conversationId,
      turnId,
      turnRequest,
    );
    sendJson(response, result.created ? 202 : 200, result);
    return;
  }

  if (
    segments[3] === 'turns' && segments[4] && segments[5] === 'cancellation'
    && segments.length === 6 && request.method === 'PUT'
  ) {
    const turn = options.engine.cancel(
      conversationId,
      requireUuid(segments[4], 'turnId'),
    );
    sendJson(response, 200, { turn });
    return;
  }

  if (
    segments[3] === 'approvals' && segments[4] && segments.length === 5
    && request.method === 'PUT'
  ) {
    const requestId = requireUuid(segments[4], 'requestId');
    const body = await readJsonObject(request);
    if (body['decision'] !== 'allow_once' && body['decision'] !== 'deny') {
      throw new PlaygroundError(400, 'decision must be allow_once or deny');
    }
    options.engine.approve(conversationId, requestId, body['decision']);
    sendJson(response, 200, {
      resolved: true,
      requestId,
      decision: body['decision'],
    });
    return;
  }

  if (
    segments[3] === 'artifacts' && segments[4] && segments.length === 5
    && request.method === 'GET'
  ) {
    response.setHeader(
      'X-GenUI-Artifact-SHA256',
      options.store.artifactHash(conversationId, segments[4]),
    );
    sendText(
      response,
      200,
      options.store.readArtifact(conversationId, segments[4]),
      'application/xml; charset=utf-8',
    );
    return;
  }

  if (
    segments[3] === 'events' && segments.length === 4
    && request.method === 'GET'
  ) {
    const afterParameter = url.searchParams.get('after');
    const lastEventId = request.headers['last-event-id'];
    if (
      afterParameter !== null && lastEventId !== undefined
      && afterParameter !== lastEventId
    ) {
      throw new PlaygroundError(400, 'after and Last-Event-ID must match');
    }
    const after = parseSequence(
      afterParameter ?? lastEventId ?? '0',
    );
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    for (const event of options.store.eventsAfter(conversationId, after)) {
      if (!writeSseFrame(response, encodeSse(event))) return;
    }
    const targets = context.subscribers.get(conversationId) ?? new Set();
    targets.add(response);
    context.subscribers.set(conversationId, targets);
    const keepAlive = setInterval(
      () => {
        if (writeSseFrame(response, ': keepalive\n\n')) return;
        clearInterval(keepAlive);
        targets.delete(response);
        if (targets.size === 0) {
          context.subscribers.delete(conversationId);
        }
      },
      15_000,
    );
    request.on('close', () => {
      clearInterval(keepAlive);
      targets.delete(response);
      if (targets.size === 0) context.subscribers.delete(conversationId);
    });
    return;
  }

  throw new PlaygroundError(404, 'API route not found');
}

export function writeSseFrame(
  response: Pick<
    ServerResponse,
    'destroy' | 'destroyed' | 'writableEnded' | 'write'
  >,
  frame: string,
): boolean {
  if (response.destroyed || response.writableEnded) return false;
  try {
    if (response.write(frame)) return true;
  } catch {
    // A concurrently closed browser connection is equivalent to backpressure.
  }
  if (!response.destroyed) response.destroy();
  return false;
}

export function publishSseFrame(
  targets: Set<ServerResponse>,
  frame: string,
): void {
  for (const response of targets) {
    if (writeSseFrame(response, frame)) continue;
    targets.delete(response);
  }
}

function handlePreviewRequest(
  request: IncomingMessage,
  response: ServerResponse,
  host: string,
  port: number,
  assetsRoot: string,
  controlOrigin: string,
): void {
  enforceHost(
    request,
    host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`,
  );
  const url = parseRequestUrl(request, originFor(host, port));
  if (url.pathname.startsWith('/api/')) {
    throw new PlaygroundError(404, 'Not found');
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw new PlaygroundError(405, 'Method not allowed');
  }
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader(
    'Content-Security-Policy',
    [
      'default-src \'none\'',
      // Lynx compiles the accepted XML into blob-backed scripts and styles.
      // Network destinations remain limited to this credential-free origin.
      'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' blob:',
      'style-src \'self\' \'unsafe-inline\' blob:',
      'img-src \'none\'',
      'font-src \'none\'',
      'connect-src \'self\' blob:',
      'media-src \'none\'',
      'object-src \'none\'',
      // Lynx Web creates one sandboxed same-origin srcdoc realm for main-thread
      // code. External frame destinations remain outside this source list.
      'frame-src \'self\'',
      'child-src \'none\'',
      'worker-src \'self\' blob:',
      'form-action \'none\'',
      'base-uri \'none\'',
      `frame-ancestors ${controlOrigin}`,
      'sandbox allow-scripts allow-same-origin',
    ].join('; '),
  );
  serveStatic(
    response,
    assetsRoot,
    url.pathname === '/' ? '/preview.html' : url.pathname,
    request.method === 'HEAD',
    'preview',
  );
}

function authenticate(
  request: IncomingMessage,
  sessions: Map<string, Session>,
): Session {
  const sessionId = parseCookies(request.headers.cookie)['genui_session'];
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session || session.expiresAt < Date.now()) {
    if (sessionId) sessions.delete(sessionId);
    throw new PlaygroundError(401, 'Bootstrap authentication required');
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function enforceHost(request: IncomingMessage, expected: string): void {
  if (request.headers.host !== expected) {
    throw new PlaygroundError(403, 'Invalid Host header');
  }
}

function enforceOrigin(request: IncomingMessage, expected: string): void {
  if (request.headers.origin !== expected) {
    throw new PlaygroundError(403, 'Invalid Origin header');
  }
}

function parseRequestUrl(request: IncomingMessage, origin: string): URL {
  const raw = request.url ?? '/';
  if (raw.includes('\0')) throw new PlaygroundError(400, 'Invalid path');
  try {
    return new URL(raw, origin);
  } catch {
    throw new PlaygroundError(400, 'Invalid URL');
  }
}

function routeSegments(pathname: string): string[] {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new PlaygroundError(400, 'Invalid URL encoding');
  }
  const segments = decoded.split('/').filter(Boolean);
  if (
    segments.some((segment) =>
      segment === '.' || segment === '..' || segment.includes('\\')
    )
  ) {
    throw new PlaygroundError(400, 'Invalid path');
  }
  return segments;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > BODY_LIMIT) {
      throw new PlaygroundError(413, 'Request body too large');
    }
    chunks.push(Buffer.from(buffer));
  }
  try {
    const source = Buffer.concat(chunks).toString('utf8');
    return source ? JSON.parse(source) : {};
  } catch {
    throw new PlaygroundError(400, 'Request body must be valid JSON');
  }
}

async function readJsonObject(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const value = await readJson(request);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PlaygroundError(400, 'Request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

function parseTurnRequest(body: Record<string, unknown>): TurnRequest {
  if (typeof body['sessionId'] !== 'string') {
    throw new PlaygroundError(400, 'sessionId is required');
  }
  if (typeof body['prompt'] !== 'string' || !body['prompt'].trim()) {
    throw new PlaygroundError(400, 'prompt must be a non-empty string');
  }
  return {
    sessionId: requireUuid(body['sessionId'], 'sessionId'),
    prompt: body['prompt'],
    agentId: requireAgentId(body['agentId']),
    ...(typeof body['model'] === 'string' && body['model']
      ? { model: body['model'].slice(0, 200) }
      : {}),
    ...(typeof body['effort'] === 'string' && body['effort']
      ? { effort: body['effort'].slice(0, 100) }
      : {}),
  };
}

function requireAgentId(value: unknown): AgentId {
  if (
    value === 'codex' || value === 'claude' || value === 'cursor'
    || value === 'trae'
  ) {
    return value;
  }
  throw new PlaygroundError(400, 'Unknown agentId');
}

function parseSequence(value: string | string[]): number {
  const source = Array.isArray(value) ? value[0] ?? '0' : value;
  if (!/^\d+$/u.test(source)) {
    throw new PlaygroundError(400, 'after must be a non-negative integer');
  }
  const sequence = Number(source);
  if (!Number.isSafeInteger(sequence)) {
    throw new PlaygroundError(400, 'after must be a safe integer');
  }
  return sequence;
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (value === null) return fallback;
  if (!/^\d+$/u.test(value)) {
    throw new PlaygroundError(
      400,
      'Pagination value must be a non-negative integer',
    );
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > maximum) {
    throw new PlaygroundError(
      400,
      `Pagination value must not exceed ${maximum}`,
    );
  }
  return number;
}

function encodeSse(event: PlaygroundEvent): string {
  return `id: ${event.sequence}\nevent: ${event.type}\ndata: ${
    JSON.stringify(event)
  }\n\n`;
}

function createPreviewIsolation(
  controlOrigin: string,
  previewOrigin: string,
  previewBoundHost: string,
  previewHost: string,
  dynamicPort: boolean,
): PreviewIsolation {
  const distinctPort = new URL(controlOrigin).port
    !== new URL(previewOrigin).port;
  const isolationCompliant = previewBoundHost === '127.0.0.1'
    && previewHost === 'localhost' && distinctPort && dynamicPort;
  return {
    status: isolationCompliant ? 'isolated' : 'degraded',
    isolationCompliant,
    controlHost: '127.0.0.1',
    previewHost,
    controlBoundHost: '127.0.0.1',
    previewBoundHost,
    controlOrigin,
    previewOrigin,
    distinctPort,
    ...(isolationCompliant
      ? {}
      : {
        reason:
          'Preview must use localhost on a distinct dynamically assigned port bound to 127.0.0.1',
      }),
  };
}

function serverPort(server: Server): number {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Preview listener did not expose a TCP port');
  }
  return address.port;
}
function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) {
    throw new PlaygroundError(400, `Unknown request field: ${unknown}`);
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    result[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }
  return result;
}

function setControlSecurityHeaders(
  response: ServerResponse,
  previewOrigin: string,
): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  response.setHeader(
    'Content-Security-Policy',
    [
      'default-src \'self\'',
      'script-src \'self\'',
      'style-src \'self\'',
      'img-src \'self\' data:',
      'connect-src \'self\'',
      `frame-src ${previewOrigin}`,
      'object-src \'none\'',
      'base-uri \'none\'',
      'form-action \'self\'',
      'frame-ancestors \'none\'',
    ].join('; '),
  );
}

function serveStatic(
  response: ServerResponse,
  root: string,
  requestPath: string,
  headOnly: boolean,
  surface: 'control' | 'preview',
): void {
  const segments = routeSegments(requestPath);
  const relativePath = segments.join('/');
  if (!isAllowedStaticAsset(surface, relativePath)) {
    throw new PlaygroundError(404, 'Not found');
  }
  const resolvedRoot = path.resolve(root);
  const file = path.resolve(resolvedRoot, ...segments);
  if (file !== resolvedRoot && !file.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new PlaygroundError(400, 'Invalid static path');
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new PlaygroundError(404, 'Not found');
  }
  const extension = path.extname(file);
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.wasm': 'application/wasm',
    '.json': 'application/json; charset=utf-8',
  };
  response.statusCode = 200;
  response.setHeader(
    'Content-Type',
    types[extension] ?? 'application/octet-stream',
  );
  response.setHeader('Content-Length', fs.statSync(file).size);
  if (headOnly) response.end();
  else fs.createReadStream(file).pipe(response);
}

function isAllowedStaticAsset(
  surface: 'control' | 'preview',
  relativePath: string,
): boolean {
  if (surface === 'control') {
    return relativePath === 'index.html'
      || /^static\/js\/index\.[0-9a-f]+\.js$/u.test(relativePath)
      || /^static\/css\/index\.[0-9a-f]+\.css$/u.test(relativePath);
  }
  return relativePath === 'preview.html'
    || /^static\/js\/preview\.[0-9a-f]+\.js$/u.test(relativePath)
    || /^static\/css\/preview\.[0-9a-f]+\.css$/u.test(relativePath)
    || /^static\/js\/async\/[a-z0-9-]+\.[0-9a-f]+\.js$/u.test(relativePath)
    || /^static\/css\/async\/[a-z0-9-]+\.[0-9a-f]+\.css$/u.test(relativePath)
    || /^static\/wasm\/[0-9a-f]+\.module\.wasm$/u.test(relativePath);
}

function isMutating(method: string | undefined): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  if (response.headersSent) return;
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(value));
}

function sendText(
  response: ServerResponse,
  status: number,
  value: string,
  contentType: string,
): void {
  if (response.headersSent) return;
  response.statusCode = status;
  response.setHeader('Content-Type', contentType);
  response.setHeader('Cache-Control', 'no-store');
  response.end(value);
}

function sendError(response: ServerResponse, error: unknown): void {
  if (response.headersSent) {
    response.end();
    return;
  }
  const status = error instanceof PlaygroundError ? error.status : 500;
  const code = error instanceof PlaygroundError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof Error ? error.message : 'Internal error';
  sendJson(response, status, { error: { code, message } });
}

function listen(
  server: Server,
  port: number,
  host: string,
  label: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      server.off('listening', onListening);
      if (error.code === 'EADDRINUSE') {
        error.message =
          `Cannot start GenUI playground: ${label} address ${host}:${port} is already in use`;
      }
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
}

function originFor(host: string, port: number): string {
  return `http://${host.includes(':') ? `[${host}]` : host}:${port}`;
}
