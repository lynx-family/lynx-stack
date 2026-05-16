// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { NextResponse } from 'next/server';

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://lynx-stack.dev',
]);

function getConfiguredOrigins(): Set<string> {
  const { A2UI_CORS_ORIGINS } = process.env;
  const configured = A2UI_CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    return (
      url.protocol === 'http:'
      && (
        hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '0.0.0.0'
        || hostname.startsWith('10.')
        || hostname.startsWith('192.168.')
        || /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname)
      )
    );
  } catch {
    return false;
  }
}

function resolveAllowedOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  // Server-to-server traffic (no Origin header) is allowed to receive a
  // wildcard ACAO. Browsers always send Origin on cross-origin requests, so
  // this only applies to non-browser callers and does not weaken CORS for
  // browser clients.
  if (!origin) return '*';
  if (getConfiguredOrigins().has(origin) || isLocalDevOrigin(origin)) {
    return origin;
  }
  return null;
}

export function corsHeaders(
  req: Request,
  extra?: HeadersInit,
): Headers {
  const headers = new Headers(extra);
  const allowedOrigin = resolveAllowedOrigin(req);
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With',
  );
  headers.set('Access-Control-Max-Age', '86400');
  headers.append('Vary', 'Origin');
  return headers;
}

export function corsPreflight(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}

export function jsonWithCors(
  req: Request,
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: corsHeaders(req, init?.headers),
  });
}
