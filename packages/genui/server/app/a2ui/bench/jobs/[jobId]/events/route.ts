// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getBenchJobStore } from '../../../../../../service/a2ui-bench-store';
import type { BenchJobEvent } from '../../../../../../service/a2ui-bench-types';
import { corsPreflight } from '../../../../../common/cors';
import {
  encodeSSE,
  encodeSseComment,
  sseHeaders,
} from '../../../../../common/sse';

const HEARTBEAT_INTERVAL_MS = 15_000;

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
  return encodeSSE(event.event, event.data, { id: event.id });
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
    const body = encodeSSE('error', { message: 'bench job not found' });
    return new Response(body, {
      headers: sseHeaders(req),
    });
  }

  let unsubscribe = noop;
  let cleanup = noop;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      cleanup = () => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = undefined;
        }
        unsubscribe();
        unsubscribe = noop;
      };
      const enqueue = (chunk: Uint8Array): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          closed = true;
          cleanup();
          return false;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        controller.close();
      };
      heartbeat = setInterval(() => {
        enqueue(encodeSseComment('ping'));
      }, HEARTBEAT_INTERVAL_MS);
      const subscription = store.subscribe(jobId, (event) => {
        if (!enqueue(encodeSseEvent(event))) return;
        if (isTerminalEvent(event)) {
          close();
        }
      });
      if (!subscription) {
        enqueue(
          encodeSseEvent({
            id: 0,
            event: 'error',
            data: { message: 'bench job not found' },
          }),
        );
        close();
        return;
      }
      unsubscribe = subscription.unsubscribe;
      for (const event of subscription.events) {
        if (!enqueue(encodeSseEvent(event))) return;
        if (isTerminalEvent(event)) {
          close();
          return;
        }
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: sseHeaders(req),
  });
}
