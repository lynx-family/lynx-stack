// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';

import {
  redactBenchDiagnostic,
  sanitizeBenchPublicValue,
} from './a2ui-bench-redaction';
import {
  MAX_BENCH_JOB_SCREENSHOT_DECODED_BYTES,
  MAX_BENCH_SCREENSHOT_DECODED_BYTES,
  benchScreenshotDecodedBytes,
} from './a2ui-bench-screenshot';
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
const MAX_RETAINED_JOBS = 20;

export const MAX_ACTIVE_BENCH_JOBS = 2;

type BenchEventListener = (event: BenchJobEvent) => void;

export interface BenchJobStoreOptions {
  maxActiveJobs?: number;
  maxRetainedJobs?: number;
}

export type BenchJobAdmission =
  | {
    ok: true;
    job: BenchJobRecord;
  }
  | {
    ok: false;
    activeJobs: number;
    limit: number;
  };

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
  workerActive: boolean;
}

function snapshotJob(job: BenchJobRecord): BenchJobSnapshot {
  return sanitizeBenchPublicValue({
    ok: true,
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    ...(job.report ? { summary: job.report.summary } : {}),
    ...(job.error ? { error: job.error } : {}),
    warnings: job.warnings,
  }, job.request.provider) as BenchJobSnapshot;
}

export class BenchJobStore {
  private readonly jobs = new Map<string, BenchJobRecord>();
  private readonly maxActiveJobs: number;
  private readonly maxRetainedJobs: number;

  public constructor(options: BenchJobStoreOptions = {}) {
    this.maxActiveJobs = options.maxActiveJobs ?? MAX_ACTIVE_BENCH_JOBS;
    this.maxRetainedJobs = options.maxRetainedJobs ?? MAX_RETAINED_JOBS;
  }

  public createJob(
    request: BenchJobRequest,
    totalRuns: number,
    warnings: string[] = [],
  ): BenchJobRecord {
    const admission = this.tryCreateJob(request, totalRuns, warnings);
    if (!admission.ok) {
      throw new Error(
        `Bench active job capacity reached (${admission.activeJobs}/${admission.limit})`,
      );
    }
    return admission.job;
  }

  public tryCreateJob(
    request: BenchJobRequest,
    totalRuns: number,
    warnings: string[] = [],
  ): BenchJobAdmission {
    this.sweepOldJobs();
    const activeJobs = this.countActiveJobs();
    if (activeJobs >= this.maxActiveJobs) {
      return {
        ok: false,
        activeJobs,
        limit: this.maxActiveJobs,
      };
    }
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
      warnings: [...warnings],
      abortController: new AbortController(),
      events: [],
      nextEventId: 1,
      listeners: new Set(),
      workerActive: true,
    };
    this.jobs.set(job.id, job);
    this.emit(job.id, 'job', snapshotJob(job));
    return { ok: true, job };
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
    if (error) {
      job.error = redactBenchDiagnostic(error, job.request.provider);
    }
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
    let storedResult = result;
    if (result.screenshotDataUrl) {
      const screenshotBytes = benchScreenshotDecodedBytes(
        result.screenshotDataUrl,
      );
      const existingScreenshotBytes = job.results.reduce(
        (total, item) =>
          total
          + (item.screenshotDataUrl
            ? benchScreenshotDecodedBytes(item.screenshotDataUrl) ?? 0
            : 0),
        0,
      );
      const overSingleLimit = screenshotBytes === null
        || screenshotBytes > MAX_BENCH_SCREENSHOT_DECODED_BYTES;
      const overJobLimit = screenshotBytes !== null
        && existingScreenshotBytes + screenshotBytes
          > MAX_BENCH_JOB_SCREENSHOT_DECODED_BYTES;
      if (overSingleLimit || overJobLimit) {
        const warning = overSingleLimit
          ? `UI Judge screenshot for run ${result.id} exceeded the 2 MiB limit and was discarded.`
          : `UI Judge screenshot for run ${result.id} exceeded the 8 MiB per-job limit and was discarded.`;
        storedResult = { ...result };
        delete storedResult.screenshotDataUrl;
        storedResult.judgeWarnings = [
          ...(storedResult.judgeWarnings ?? []),
          warning,
        ];
        job.warnings.push(warning);
      }
    }
    job.results.push(storedResult);
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
    const provider = job.request.provider;
    job.error = job.error
      ? redactBenchDiagnostic(job.error, provider)
      : undefined;
    job.warnings = job.warnings.map((warning) =>
      redactBenchDiagnostic(warning, provider)
    );
    job.report = sanitizeBenchPublicValue(
      report,
      provider,
    ) as BenchReport;
    job.workerActive = false;
    job.updatedAt = new Date().toISOString();
    this.emit(jobId, 'report', job.report);
    this.emit(jobId, 'job', snapshotJob(job));
    job.request.provider = {};
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
      data: sanitizeBenchPublicValue(data, job.request.provider),
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
    if (this.jobs.size < this.maxRetainedJobs) return;
    const sorted = [...this.jobs.values()].sort(
      (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    );
    const removeCount = Math.max(
      1,
      sorted.length - this.maxRetainedJobs + 1,
    );
    for (
      const job of sorted.filter((candidate) =>
        !candidate.workerActive && candidate.report
      ).slice(0, removeCount)
    ) {
      this.jobs.delete(job.id);
    }
  }

  private countActiveJobs(): number {
    return [...this.jobs.values()].filter((job) => job.workerActive).length;
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
