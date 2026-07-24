// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getBenchJobStore } from '../../../../../service/a2ui-bench-store';
import { corsPreflight, jsonWithCors } from '../../../../common/cors';

interface RouteContext {
  params: Promise<{ jobId: string }> | { jobId: string };
}

async function readJobId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.jobId;
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request, context: RouteContext) {
  const jobId = await readJobId(context);
  const snapshot = getBenchJobStore().getSnapshot(jobId);
  if (!snapshot) {
    return jsonWithCors(
      req,
      { ok: false, error: 'bench job not found' },
      { status: 404 },
    );
  }
  return jsonWithCors(req, snapshot);
}

export async function DELETE(req: Request, context: RouteContext) {
  const jobId = await readJobId(context);
  const job = getBenchJobStore().cancelJob(jobId);
  if (!job) {
    return jsonWithCors(
      req,
      { ok: false, error: 'bench job not found' },
      { status: 404 },
    );
  }
  return jsonWithCors(req, getBenchJobStore().getSnapshot(jobId));
}
