// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import a2uiActionRoute from '../app/a2ui/action/route.js';
import a2uiActionStreamRoute from '../app/a2ui/action/stream/route.js';
import a2uiBenchEventsRoute from '../app/a2ui/bench/jobs/[jobId]/events/route.js';
import a2uiBenchReportRoute from '../app/a2ui/bench/jobs/[jobId]/report/route.js';
import a2uiBenchJobRoute from '../app/a2ui/bench/jobs/[jobId]/route.js';
import a2uiBenchJobsRoute from '../app/a2ui/bench/jobs/route.js';
import a2uiChatRoute from '../app/a2ui/chat/route.js';
import a2uiHealthRoute from '../app/a2ui/health/route.js';
import a2uiPayloadRoute from '../app/a2ui/payload/route.js';
import a2uiStreamRoute from '../app/a2ui/stream/route.js';
import { corsPreflight, jsonWithCors } from '../app/common/cors.js';
import mcpAppsMetadataRoute from '../app/mcp-apps/metadata/route.js';
import mcpAppsStreamRoute from '../app/mcp-apps/stream/route.js';
import modelsRoute from '../app/models/route.js';
import openuiPayloadRoute from '../app/openui/payload/route.js';
import openuiStreamRoute from '../app/openui/stream/route.js';

const app = new Hono({ strict: false });

app.route('/a2ui/action', a2uiActionRoute);
app.route('/a2ui/action/stream', a2uiActionStreamRoute);
app.route('/a2ui/bench/jobs', a2uiBenchJobsRoute);
app.route('/a2ui/bench/jobs', a2uiBenchJobRoute);
app.route('/a2ui/bench/jobs', a2uiBenchEventsRoute);
app.route('/a2ui/bench/jobs', a2uiBenchReportRoute);
app.route('/a2ui/chat', a2uiChatRoute);
app.route('/a2ui/health', a2uiHealthRoute);
app.route('/a2ui/payload', a2uiPayloadRoute);
app.route('/a2ui/stream', a2uiStreamRoute);
app.route('/mcp-apps/metadata', mcpAppsMetadataRoute);
app.route('/mcp-apps/stream', mcpAppsStreamRoute);
app.route('/models', modelsRoute);
app.route('/openui/payload', openuiPayloadRoute);
app.route('/openui/stream', openuiStreamRoute);

const allowedMethodsByPath = new Map<string, Set<string>>();
for (const { method, path } of app.routes) {
  const methods = allowedMethodsByPath.get(path) ?? new Set<string>();
  methods.add(method);
  allowedMethodsByPath.set(path, methods);
}

for (const [path, routeMethods] of allowedMethodsByPath) {
  const methods = [...routeMethods, 'OPTIONS'];
  app.options(path, (context) => corsPreflight(context.req.raw));
  app.all(path, (context) =>
    jsonWithCors(
      context.req.raw,
      { ok: false, error: 'method not allowed' },
      {
        status: 405,
        headers: { Allow: methods.join(', ') },
      },
    ));
}

app.notFound((context) =>
  jsonWithCors(
    context.req.raw,
    { ok: false, error: 'not found' },
    { status: 404 },
  )
);

app.onError((error, context) => {
  if (error instanceof URIError) {
    return jsonWithCors(
      context.req.raw,
      { ok: false, error: 'invalid URL path parameter' },
      { status: 400 },
    );
  }

  console.error(error);
  return jsonWithCors(
    context.req.raw,
    { ok: false, error: 'internal server error' },
    { status: 500 },
  );
});

export default app;
