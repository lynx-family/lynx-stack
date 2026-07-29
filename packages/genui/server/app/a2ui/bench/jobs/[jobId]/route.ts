// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { getBenchJobStore } from '../../../../../service/a2ui-bench-store';
import { jsonWithCors } from '../../../../common/cors';

function getA2UIBenchJob(req: Request, jobId: string) {
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

function deleteA2UIBenchJob(req: Request, jobId: string) {
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

const route = new Hono();

route.get(
  '/:jobId',
  (context) => getA2UIBenchJob(context.req.raw, context.req.param('jobId')),
);
route.delete(
  '/:jobId',
  (context) => deleteA2UIBenchJob(context.req.raw, context.req.param('jobId')),
);

export default route;
