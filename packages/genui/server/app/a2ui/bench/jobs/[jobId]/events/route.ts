// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getBenchJobStore } from '../../../../../../service/a2ui-bench-store';
import type { BenchJobEvent } from '../../../../../../service/a2ui-bench-types';
import { corsHeaders, corsPreflight } from '../../../../cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ jobId: string }> | { jobId: string };
}

function noop(): void {
  // Intentionally empty.
}

async function readJobId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.jobId;
}

function encodeSseEvent(event: BenchJobEvent): Uint8Array {
  const payload = JSON.stringify(event.data);
  return new TextEncoder().encode(
    `id: ${event.id}\nevent: ${event.event}\ndata: ${payload}\n\n`,
  );
}

function isTerminalEvent(event: BenchJobEvent): boolean {
  return event.event === 'report' || event.event === 'error';
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request, context: RouteContext) {
  const jobId = await readJobId(context);
  const store = getBenchJobStore();
  const job = store.getJob(jobId);
  if (!job) {
    const body = new TextEncoder().encode(
      `event: error\ndata: ${
        JSON.stringify({ message: 'bench job not found' })
      }\n\n`,
    );
    return new Response(body, {
      status: 404,
      headers: corsHeaders(req, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      }),
    });
  }

  let unsubscribe = noop;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const subscription = store.subscribe(jobId, (event) => {
        controller.enqueue(encodeSseEvent(event));
        if (isTerminalEvent(event)) {
          unsubscribe();
          controller.close();
        }
      });
      if (!subscription) {
        controller.enqueue(
          new TextEncoder().encode(
            `event: error\ndata: ${
              JSON.stringify({ message: 'bench job not found' })
            }\n\n`,
          ),
        );
        controller.close();
        return;
      }
      unsubscribe = subscription.unsubscribe;
      for (const event of subscription.events) {
        controller.enqueue(encodeSseEvent(event));
        if (isTerminalEvent(event)) {
          unsubscribe();
          controller.close();
          return;
        }
      }
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: corsHeaders(req, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    }),
  });
}
