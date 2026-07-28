// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { getBenchJobStore } from '../../../../../../service/a2ui-bench-store';
import { jsonWithCors } from '../../../../../common/cors';

function getA2UIBenchJobReport(req: Request, jobId: string) {
  const job = getBenchJobStore().getJob(jobId);
  if (!job) {
    return jsonWithCors(
      req,
      { ok: false, error: 'bench job not found' },
      { status: 404 },
    );
  }
  if (!job.report) {
    return jsonWithCors(
      req,
      { ok: false, error: 'bench report is not ready' },
      { status: 409 },
    );
  }
  return jsonWithCors(req, job.report);
}

const route = new Hono();

route.get('/:jobId/report', (context) =>
  getA2UIBenchJobReport(context.req.raw, context.req.param('jobId')));

export default route;
