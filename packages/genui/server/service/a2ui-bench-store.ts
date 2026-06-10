// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';

import type {
  BenchJobEvent,
  BenchJobRequest,
  BenchJobSnapshot,
  BenchJobStatus,
  BenchProgress,
  BenchReport,
  BenchRunResult,
} from './a2ui-bench-types';

const MAX_EVENT_HISTORY = 500;
const MAX_JOBS = 20;

type BenchEventListener = (event: BenchJobEvent) => void;

export interface BenchJobRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BenchJobStatus;
  request: BenchJobRequest;
  progress: BenchProgress;
  results: BenchRunResult[];
  warnings: string[];
  abortController: AbortController;
  error?: string;
  report?: BenchReport;
  events: BenchJobEvent[];
  nextEventId: number;
  listeners: Set<BenchEventListener>;
}

function snapshotJob(job: BenchJobRecord): BenchJobSnapshot {
  return {
    ok: true,
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    ...(job.report ? { summary: job.report.summary } : {}),
    ...(job.error ? { error: job.error } : {}),
    warnings: job.warnings,
  };
}

export class BenchJobStore {
  private jobs = new Map<string, BenchJobRecord>();

  public createJob(
    request: BenchJobRequest,
    totalRuns: number,
    warnings: string[] = [],
  ): BenchJobRecord {
    this.sweepOldJobs();
    const now = new Date().toISOString();
    const job: BenchJobRecord = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      request,
      progress: {
        completedRuns: 0,
        totalRuns,
      },
      results: [],
      warnings,
      abortController: new AbortController(),
      events: [],
      nextEventId: 1,
      listeners: new Set(),
    };
    this.jobs.set(job.id, job);
    this.emit(job.id, 'job', snapshotJob(job));
    return job;
  }

  public getJob(jobId: string): BenchJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  public getSnapshot(jobId: string): BenchJobSnapshot | null {
    const job = this.jobs.get(jobId);
    return job ? snapshotJob(job) : null;
  }

  public updateStatus(
    jobId: string,
    status: BenchJobStatus,
    error?: string,
  ): BenchJobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    job.status = status;
    job.updatedAt = new Date().toISOString();
    if (error) job.error = error;
    this.emit(jobId, 'job', snapshotJob(job));
    return job;
  }

  public updateProgress(
    jobId: string,
    progress: Partial<BenchProgress>,
  ): BenchJobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    job.progress = {
      ...job.progress,
      ...progress,
    };
    job.updatedAt = new Date().toISOString();
    return job;
  }

  public addResult(
    jobId: string,
    result: BenchRunResult,
  ): BenchJobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    job.results.push(result);
    job.progress.completedRuns = job.results.length;
    job.updatedAt = new Date().toISOString();
    return job;
  }

  public setReport(
    jobId: string,
    report: BenchReport,
  ): BenchJobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    job.report = report;
    job.updatedAt = new Date().toISOString();
    this.emit(jobId, 'report', report);
    this.emit(jobId, 'job', snapshotJob(job));
    return job;
  }

  public cancelJob(jobId: string): BenchJobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    if (
      job.status === 'complete'
      || job.status === 'failed'
      || job.status === 'cancelled'
    ) {
      return job;
    }
    job.abortController.abort();
    return this.updateStatus(jobId, 'cancelled');
  }

  public emit(jobId: string, event: string, data: unknown): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const item: BenchJobEvent = {
      id: job.nextEventId++,
      event,
      data,
    };
    job.events.push(item);
    if (job.events.length > MAX_EVENT_HISTORY) {
      job.events.splice(0, job.events.length - MAX_EVENT_HISTORY);
    }
    for (const listener of job.listeners) listener(item);
  }

  public subscribe(
    jobId: string,
    listener: BenchEventListener,
  ): { events: BenchJobEvent[]; unsubscribe: () => void } | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.listeners.add(listener);
    return {
      events: [...job.events],
      unsubscribe: () => {
        job.listeners.delete(listener);
      },
    };
  }

  private sweepOldJobs(): void {
    if (this.jobs.size < MAX_JOBS) return;
    const sorted = [...this.jobs.values()].sort(
      (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    );
    for (const job of sorted.slice(0, Math.max(1, sorted.length - MAX_JOBS))) {
      if (job.status === 'running') continue;
      this.jobs.delete(job.id);
    }
  }
}

const STORE_KEY = '__A2UI_BENCH_JOB_STORE__';
type GlobalWithBenchStore = typeof globalThis & {
  [STORE_KEY]?: BenchJobStore;
};

export function getBenchJobStore(): BenchJobStore {
  const g = globalThis as GlobalWithBenchStore;
  g[STORE_KEY] ??= new BenchJobStore();
  return g[STORE_KEY];
}
