// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as a2uiAction from '../app/a2ui/action/route';
import * as a2uiActionStream from '../app/a2ui/action/stream/route';
import * as a2uiBenchEvents from '../app/a2ui/bench/jobs/[jobId]/events/route';
import * as a2uiBenchReport from '../app/a2ui/bench/jobs/[jobId]/report/route';
import * as a2uiBenchJob from '../app/a2ui/bench/jobs/[jobId]/route';
import * as a2uiBenchJobs from '../app/a2ui/bench/jobs/route';
import * as a2uiChat from '../app/a2ui/chat/route';
import * as a2uiHealth from '../app/a2ui/health/route';
import * as a2uiPayload from '../app/a2ui/payload/route';
import * as a2uiStream from '../app/a2ui/stream/route';
import { jsonWithCors } from '../app/common/cors';
import * as mcpAppsMetadata from '../app/mcp-apps/metadata/route';
import * as mcpAppsStream from '../app/mcp-apps/stream/route';
import * as openuiPayload from '../app/openui/payload/route';
import * as openuiStream from '../app/openui/stream/route';

type RouteResult = Response | Promise<Response>;
type RouteParams = Record<string, string>;
type RouteHandler = (request: Request, params: RouteParams) => RouteResult;
type StaticRouteHandler = (request: Request) => RouteResult;
type JobRouteHandler = (
  request: Request,
  context: { params: { jobId: string } },
) => RouteResult;

interface RouteDefinition {
  pattern: RegExp;
  paramNames?: string[];
  handlers: Record<string, RouteHandler>;
}

function staticHandler(handler: StaticRouteHandler): RouteHandler {
  return (request) => handler(request);
}

function jobHandler(handler: JobRouteHandler): RouteHandler {
  return (request, params) =>
    handler(request, { params: { jobId: params.jobId ?? '' } });
}

const routes: RouteDefinition[] = [
  {
    pattern: /^\/a2ui\/action$/u,
    handlers: {
      OPTIONS: staticHandler(a2uiAction.OPTIONS),
      POST: staticHandler(a2uiAction.POST),
    },
  },
  {
    pattern: /^\/a2ui\/action\/stream$/u,
    handlers: {
      OPTIONS: staticHandler(a2uiActionStream.OPTIONS),
      POST: staticHandler(a2uiActionStream.POST),
    },
  },
  {
    pattern: /^\/a2ui\/bench\/jobs$/u,
    handlers: {
      OPTIONS: staticHandler(a2uiBenchJobs.OPTIONS),
      POST: staticHandler(a2uiBenchJobs.POST),
    },
  },
  {
    pattern: /^\/a2ui\/bench\/jobs\/([^/]+)$/u,
    paramNames: ['jobId'],
    handlers: {
      DELETE: jobHandler(a2uiBenchJob.DELETE),
      GET: jobHandler(a2uiBenchJob.GET),
      OPTIONS: staticHandler(a2uiBenchJob.OPTIONS),
    },
  },
  {
    pattern: /^\/a2ui\/bench\/jobs\/([^/]+)\/events$/u,
    paramNames: ['jobId'],
    handlers: {
      GET: jobHandler(a2uiBenchEvents.GET),
      OPTIONS: staticHandler(a2uiBenchEvents.OPTIONS),
    },
  },
  {
    pattern: /^\/a2ui\/bench\/jobs\/([^/]+)\/report$/u,
    paramNames: ['jobId'],
    handlers: {
      GET: jobHandler(a2uiBenchReport.GET),
      OPTIONS: staticHandler(a2uiBenchReport.OPTIONS),
    },
  },
  {
    pattern: /^\/a2ui\/chat$/u,
    handlers: {
      OPTIONS: staticHandler(a2uiChat.OPTIONS),
      POST: staticHandler(a2uiChat.POST),
    },
  },
  {
    pattern: /^\/a2ui\/health$/u,
    handlers: {
      GET: staticHandler(a2uiHealth.GET),
      OPTIONS: staticHandler(a2uiHealth.OPTIONS),
    },
  },
  {
    pattern: /^\/a2ui\/payload$/u,
    handlers: {
      OPTIONS: staticHandler(a2uiPayload.OPTIONS),
      POST: staticHandler(a2uiPayload.POST),
    },
  },
  {
    pattern: /^\/a2ui\/stream$/u,
    handlers: {
      OPTIONS: staticHandler(a2uiStream.OPTIONS),
      POST: staticHandler(a2uiStream.POST),
    },
  },
  {
    pattern: /^\/mcp-apps\/metadata$/u,
    handlers: {
      GET: staticHandler(mcpAppsMetadata.GET),
      OPTIONS: staticHandler(mcpAppsMetadata.OPTIONS),
    },
  },
  {
    pattern: /^\/mcp-apps\/stream$/u,
    handlers: {
      OPTIONS: staticHandler(mcpAppsStream.OPTIONS),
      POST: staticHandler(mcpAppsStream.POST),
    },
  },
  {
    pattern: /^\/openui\/payload$/u,
    handlers: {
      OPTIONS: staticHandler(openuiPayload.OPTIONS),
      POST: staticHandler(openuiPayload.POST),
    },
  },
  {
    pattern: /^\/openui\/stream$/u,
    handlers: {
      OPTIONS: staticHandler(openuiStream.OPTIONS),
      POST: staticHandler(openuiStream.POST),
    },
  },
];

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function readParams(
  match: RegExpExecArray,
  paramNames: string[],
): RouteParams {
  return Object.fromEntries(
    paramNames.map((name, index) => [
      name,
      decodeURIComponent(match[index + 1] ?? ''),
    ]),
  );
}

export async function routeRequest(request: Request): Promise<Response> {
  const pathname = normalizePathname(new URL(request.url).pathname);
  for (const route of routes) {
    const match = route.pattern.exec(pathname);
    if (!match) continue;

    let params: RouteParams;
    try {
      params = readParams(match, route.paramNames ?? []);
    } catch {
      return jsonWithCors(
        request,
        { ok: false, error: 'invalid URL path parameter' },
        { status: 400 },
      );
    }

    const handler = route.handlers[request.method.toUpperCase()];
    if (handler) return await handler(request, params);

    return jsonWithCors(
      request,
      { ok: false, error: 'method not allowed' },
      {
        status: 405,
        headers: { Allow: Object.keys(route.handlers).join(', ') },
      },
    );
  }

  return jsonWithCors(
    request,
    { ok: false, error: 'not found' },
    { status: 404 },
  );
}
