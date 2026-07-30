// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { normalizeBenchJobRequest } from '../../../../service/a2ui-bench-request';
import { startBenchJob } from '../../../../service/a2ui-bench-runner';
import { getBenchJobStore } from '../../../../service/a2ui-bench-store';
import { jsonWithCors } from '../../../common/cors';
import { clientOverridesAllowed } from '../../../common/provider-options';
import {
  checkRateLimit,
  rateLimitJsonResponse,
} from '../../../common/rate-limit';
import { readJsonBodyWithLimit } from '../../../common/request';

async function postA2UIBenchJob(req: Request) {
  const decision = checkRateLimit(req);
  if (!decision.ok) {
    return rateLimitJsonResponse(req, decision);
  }

  const parsed = await readJsonBodyWithLimit<unknown>(req);
  if (!parsed.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }

  const normalized = normalizeBenchJobRequest(parsed.body, {
    clientOverrideAccepted: clientOverridesAllowed(),
  });
  if (!normalized.ok) {
    return jsonWithCors(
      req,
      { ok: false, error: normalized.error },
      { status: normalized.status },
    );
  }

  const store = getBenchJobStore();
  const job = store.createJob(
    normalized.request,
    normalized.totalRuns,
    normalized.warnings,
  );
  startBenchJob(job.id);

  return jsonWithCors(req, {
    ok: true,
    jobId: job.id,
    statusUrl: `/a2ui/bench/jobs/${job.id}`,
    eventsUrl: `/a2ui/bench/jobs/${job.id}/events`,
    reportUrl: `/a2ui/bench/jobs/${job.id}/report`,
    warnings: normalized.warnings,
  });
}

const route = new Hono();

route.post('/', (context) => postA2UIBenchJob(context.req.raw));

export default route;
