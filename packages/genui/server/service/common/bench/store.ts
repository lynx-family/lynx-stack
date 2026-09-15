// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';

import { benchInFlightLimit } from './concurrency.js';
import {
  advanceBenchRunProgress,
  cancelBenchRunProgress,
  createBenchRunProgress,
  finishBenchRunProgress,
} from './progress.js';
import {
  redactBenchDiagnostic,
  sanitizeBenchPublicValue,
} from './redaction.js';
import {
  MAX_BENCH_JOB_SCREENSHOT_DECODED_BYTES,
  MAX_BENCH_SCREENSHOT_DECODED_BYTES,
  benchScreenshotDecodedBytes,
} from './screenshot.js';
import type {
  BenchJobEvent,
  BenchJobRequest,
  BenchJobSnapshot,
  BenchJobStatus,
  BenchProgress,
  BenchReport,
  BenchRunProgress,
  BenchRunResult,
} from './types.js';
import type {
  BenchScreenshotRequest,
  BenchScreenshotTask,
} from '../../a2ui/a2ui-bench-judge.js';

const MAX_EVENT_HISTORY = 500;
const MAX_RETAINED_JOBS = 20;

export const MAX_ACTIVE_BENCH_JOBS = 8;

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
  screenshots: Map<string, {
    request: BenchScreenshotRequest;
    start: () => void;
    settle: (response: Response) => void;
  }>;
  id: string;
  createdAt: string;
  startedAtMonotonicMs: number;
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
    startedAt: job.createdAt,
    durationMs: job.report?.durationMs
      ?? Math.max(0, Math.round(performance.now() - job.startedAtMonotonicMs)),
    ...(job.report ? { completedAt: job.report.completedAt } : {}),
    progress: job.progress,
    ...(job.report ? { summary: job.report.summary } : {}),
    ...(job.error ? { error: job.error } : {}),
    warnings: job.warnings,
  }, job.request.provider) as BenchJobSnapshot;
}

function matchesRun(
  run: BenchRunProgress,
  other: Pick<BenchRunProgress, 'groupId' | 'scenarioId' | 'repeatIndex'>,
): boolean {
  return run.groupId === other.groupId
    && run.scenarioId === other.scenarioId
    && run.repeatIndex === other.repeatIndex;
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
      screenshots: new Map(),
      id: randomUUID(),
      createdAt: now,
      startedAtMonotonicMs: performance.now(),
      updatedAt: now,
      status: 'queued',
      request,
      progress: {
        completedRuns: 0,
        totalRuns,
        runs: createBenchRunProgress(request),
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

  public requestScreenshot(
    jobId: string,
    request: BenchScreenshotRequest,
    signal: AbortSignal,
  ): BenchScreenshotTask {
    const job = this.jobs.get(jobId);
    if (!job || !job.workerActive || job.abortController.signal.aborted) {
      return {
        started: Promise.resolve(),
        response: Promise.reject(new Error('Bench job is no longer active.')),
      };
    }
    const captureId = randomUUID();
    const combined = AbortSignal.any([signal, job.abortController.signal]);
    let resolveStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const timeoutMs = Math.min(1_200_000, Math.max(1, request.timeoutMs));
    const queueLimit = benchInFlightLimit(
      job.request.groups.filter((group) => group.enabled).length,
    );
    const response = new Promise<Response>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        resolveStarted();
        combined.removeEventListener('abort', abort);
        job.screenshots.delete(captureId);
      };
      const abort = () => {
        cleanup();
        reject(
          combined.reason instanceof Error
            ? combined.reason
            : new Error('Screenshot cancelled.'),
        );
      };
      const expire = (message: string) => {
        cleanup();
        reject(new Error(message));
      };
      // All queued tasks have been announced. Bound a missing browser without
      // spending execution time while legitimate earlier captures are running.
      let timer = setTimeout(() => {
        expire(
          'Timed out waiting for the browser to start the screenshot. Keep the Bench page open and check the screenshot service connection.',
        );
      }, timeoutMs * queueLimit);
      let active = false;
      if (combined.aborted) {
        abort();
        return;
      }
      combined.addEventListener('abort', abort, { once: true });
      job.screenshots.set(captureId, {
        request,
        start: () => {
          if (active) return;
          active = true;
          clearTimeout(timer);
          timer = setTimeout(() => {
            expire(
              'Timed out waiting for the browser screenshot. Keep the Bench page open and check the screenshot service connection.',
            );
          }, timeoutMs);
          resolveStarted();
        },
        settle: (response) => {
          cleanup();
          resolve(response);
        },
      });
      // Artifact content is fetched separately and must not pass through event
      // redaction, which would rewrite strings inside executable page source.
      this.emit(jobId, 'screenshot-requested', { captureId });
    });
    return { started, response };
  }

  public startScreenshot(
    jobId: string,
    captureId: string,
  ): BenchScreenshotRequest | undefined {
    const task = this.jobs.get(jobId)?.screenshots.get(captureId);
    task?.start();
    return task?.request;
  }

  public getScreenshotRequest(
    jobId: string,
    captureId: string,
  ): BenchScreenshotRequest | undefined {
    return this.jobs.get(jobId)?.screenshots.get(captureId)?.request;
  }

  public submitScreenshot(
    jobId: string,
    captureId: string,
    response: Response,
  ): boolean {
    const task = this.jobs.get(jobId)?.screenshots.get(captureId);
    if (!task) return false;
    task.settle(response);
    return true;
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
    if (status === 'cancelled' || status === 'failed') {
      job.progress.runs = job.progress.runs?.map(run =>
        cancelBenchRunProgress(run)
      );
    }
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
    const current = progress.current;
    if (current) {
      job.progress.runs = job.progress.runs?.map(run =>
        matchesRun(run, current)
          ? advanceBenchRunProgress(run, current.phase)
          : run
      );
    }
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
    job.progress.runs = job.progress.runs?.map(run =>
      matchesRun(run, storedResult)
        ? finishBenchRunProgress(run, storedResult)
        : run
    );
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
    const completedAt = new Date().toISOString();
    job.report = sanitizeBenchPublicValue(
      {
        ...report,
        runProgress: job.progress.runs,
        startedAt: job.createdAt,
        completedAt,
        durationMs: Math.max(
          0,
          Math.round(performance.now() - job.startedAtMonotonicMs),
        ),
      },
      provider,
    ) as BenchReport;
    job.workerActive = false;
    job.updatedAt = completedAt;
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
      const oldestRetained = job.events.length - MAX_EVENT_HISTORY;
      // Pending captures must remain discoverable after an SSE reconnect.
      job.events = job.events.filter((entry, index) => {
        if (index >= oldestRetained) return true;
        if (entry.event !== 'screenshot-requested') return false;
        const { captureId } = entry.data as { captureId: string };
        return job.screenshots.has(captureId);
      });
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
