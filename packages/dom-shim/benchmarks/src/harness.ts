// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createWriteStream } from 'node:fs';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

import { scoreVisualSimilarity } from './scoring/visual.ts';
import type {
  BenchmarkRecord,
  BenchmarkReport,
  CorpusCategory,
  CorpusEntry,
  HarnessOptions,
  Route,
  RouteId,
  RouteMetrics,
} from './types.ts';
import { retryWithBackoff } from './utils/retry.ts';

const SCHEMA_VERSION = '1.0.0';

/**
 * Drive `routes` against `prompts` for up to `opts.rounds` LLM rounds each,
 * streaming per-record JSONL into `opts.out_dir/records.jsonl` and writing
 * the final aggregate to `report.json` + `report.md`.
 *
 * Routes are looked up from the `routes` table by `RouteId`. The harness is
 * agnostic to whether a route stubs or really calls an LLM; both honor
 * `ctx.dry_run` per the Route contract.
 */
export async function runBenchmark(
  routes: Record<RouteId, Route>,
  opts: HarnessOptions,
): Promise<BenchmarkReport> {
  const now = opts.now ?? (() => new Date());
  const startedAt = now();
  await mkdir(opts.out_dir, { recursive: true });

  const jsonlPath = resolvePath(opts.out_dir, 'records.jsonl');
  // Truncate any prior file so this run is fresh.
  await writeFile(jsonlPath, '');

  const records: BenchmarkRecord[] = [];

  // Build the (prompt, route) work list. Concurrency is along this product;
  // rounds within a (prompt, route) are sequential because round N depends on
  // round N-1 (error feedback).
  interface Cell {
    prompt: CorpusEntry;
    route: Route;
  }
  const work: Cell[] = [];
  for (const prompt of opts.prompts) {
    for (const routeId of opts.routes) {
      work.push({ prompt, route: routes[routeId] });
    }
  }

  const concurrency = Math.max(1, Math.min(opts.concurrency, work.length || 1));
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const myIndex = cursor++;
      if (myIndex >= work.length) return;
      const cell = work[myIndex];
      if (!cell) return;
      await processCell(cell);
    }
  }

  async function processCell({ prompt, route }: Cell): Promise<void> {
    let previous: { generated_code: string; error_log: string } | undefined;
    for (let round = 1; round <= opts.rounds; round++) {
      const result = await retryWithBackoff(
        () =>
          route.run({
            prompt,
            round,
            previous,
            dry_run: opts.dry_run,
            model_id: opts.model_id,
            out_dir: opts.out_dir,
          }),
        { maxAttempts: 3 },
      );
      let visualScore = result.visual_score;
      let visualRationale = result.visual_rationale;
      // If the route succeeded and produced a preview file, score it now.
      // Without ANTHROPIC_API_KEY the scorer is a soft no-op.
      if (
        !opts.dry_run
        && result.render_ok
        && result.screenshot_path
        && visualScore === null
      ) {
        const vs = await scoreVisualSimilarity({
          screenshotPath: result.screenshot_path,
          promptText: prompt.prompt,
          promptId: prompt.id,
          modelId: opts.model_id,
          cachePath: resolvePath(
            opts.out_dir,
            '..',
            '..',
            'cache',
            'visual-scores.json',
          ),
        });
        visualScore = vs.score;
        visualRationale = vs.rationale;
      }
      const rec: BenchmarkRecord = {
        prompt_id: prompt.id,
        prompt_category: prompt.category,
        prompt_complexity: prompt.complexity,
        route: route.id,
        round,
        generated_code: result.generated_code,
        parse_ok: result.parse_ok,
        render_ok: result.render_ok,
        screenshot_path: result.screenshot_path,
        error_log: result.error_log,
        visual_score: visualScore,
        visual_rationale: visualRationale,
        timestamp: now().toISOString(),
        model_id: opts.model_id,
        ...(result.tokens_used ? { tokens_used: result.tokens_used } : {}),
      };
      records.push(rec);
      await appendFile(jsonlPath, JSON.stringify(rec) + '\n');
      if (result.render_ok) {
        // Converged. Skip remaining rounds.
        return;
      }
      previous = {
        generated_code: result.generated_code,
        error_log: result.error_log,
      };
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  const finishedAt = now();
  const report = aggregate({
    schema_version: SCHEMA_VERSION,
    run_id: `run-${startedAt.toISOString().replace(/[:.]/g, '-')}`,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    model_id: opts.model_id,
    rounds: opts.rounds,
    concurrency: opts.concurrency,
    routes: opts.routes,
    prompts: opts.prompts,
    records,
  });

  await writeFile(
    resolvePath(opts.out_dir, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await writeFile(
    resolvePath(opts.out_dir, 'report.md'),
    renderReportMarkdown(report),
  );
  return report;
}

interface AggregateInput {
  schema_version: string;
  run_id: string;
  started_at: string;
  finished_at: string;
  model_id: string;
  rounds: number;
  concurrency: number;
  routes: RouteId[];
  prompts: CorpusEntry[];
  records: BenchmarkRecord[];
}

function aggregate(input: AggregateInput): BenchmarkReport {
  const summary: Partial<Record<RouteId, RouteMetrics>> = {};
  for (const r of input.routes) {
    summary[r] = computeMetrics(input.prompts, input.records, r);
  }

  const per_category: Partial<
    Record<CorpusCategory, Partial<Record<RouteId, RouteMetrics>>>
  > = {};
  const seenCats = new Set(input.prompts.map(p => p.category));
  for (const cat of seenCats) {
    const promptsInCat = input.prompts.filter(p => p.category === cat);
    const inner: Partial<Record<RouteId, RouteMetrics>> = {};
    for (const r of input.routes) {
      inner[r] = computeMetrics(promptsInCat, input.records, r);
    }
    per_category[cat] = inner;
  }

  return {
    schema_version: input.schema_version,
    run_id: input.run_id,
    started_at: input.started_at,
    finished_at: input.finished_at,
    model_id: input.model_id,
    rounds: input.rounds,
    concurrency: input.concurrency,
    summary,
    per_category,
    records: input.records,
  };
}

function computeMetrics(
  prompts: CorpusEntry[],
  records: BenchmarkRecord[],
  route: RouteId,
): RouteMetrics {
  const n = prompts.length;
  if (n === 0) {
    return {
      parse_ok_rate: 0,
      render_ok_rate: 0,
      convergence_rate: 0,
      visual_score_mean: null,
      sample_size: 0,
    };
  }

  let parseOkOneShot = 0;
  let renderOkOneShot = 0;
  let converged = 0;
  let visualSum = 0;
  let visualCount = 0;

  for (const p of prompts) {
    const cellRecords = records
      .filter(r => r.prompt_id === p.id && r.route === route)
      .sort((a, b) => a.round - b.round);
    if (cellRecords.length === 0) continue;
    const first = cellRecords[0];
    const last = cellRecords[cellRecords.length - 1];
    if (first?.parse_ok) parseOkOneShot++;
    if (first?.render_ok) renderOkOneShot++;
    if (cellRecords.some(r => r.render_ok)) converged++;
    if (last?.visual_score !== null && last?.visual_score !== undefined) {
      visualSum += last.visual_score;
      visualCount++;
    }
  }

  return {
    parse_ok_rate: parseOkOneShot / n,
    render_ok_rate: renderOkOneShot / n,
    convergence_rate: converged / n,
    visual_score_mean: visualCount > 0 ? visualSum / visualCount : null,
    sample_size: n,
  };
}

function renderReportMarkdown(report: BenchmarkReport): string {
  const lines: string[] = [];
  lines.push(`# Benchmark Report — \`${report.run_id}\``);
  lines.push('');
  lines.push(`- Model: \`${report.model_id}\``);
  lines.push(`- Started: ${report.started_at}`);
  lines.push(`- Finished: ${report.finished_at}`);
  lines.push(`- Rounds (N): ${report.rounds}`);
  lines.push(`- Concurrency: ${report.concurrency}`);
  lines.push(`- Total records: ${report.records.length}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(
    '| Route | parse_ok | render_ok | convergence | visual_score (mean) | n |',
  );
  lines.push(
    '| ----- | -------- | --------- | ----------- | ------------------- | - |',
  );
  for (const [routeId, m] of Object.entries(report.summary)) {
    if (!m) continue;
    lines.push(
      `| ${routeId} | ${fmt(m.parse_ok_rate)} | ${fmt(m.render_ok_rate)} | ${
        fmt(m.convergence_rate)
      } | ${
        m.visual_score_mean === null || m.visual_score_mean === undefined
          ? 'n/a'
          : fmt(m.visual_score_mean)
      } | ${m.sample_size ?? 0} |`,
    );
  }
  lines.push('');
  lines.push('## Per-category breakdown');
  lines.push('');
  for (const [cat, byRoute] of Object.entries(report.per_category)) {
    lines.push(`### ${cat}`);
    lines.push('');
    lines.push(
      '| Route | parse_ok | render_ok | convergence | visual_score (mean) |',
    );
    lines.push(
      '| ----- | -------- | --------- | ----------- | ------------------- |',
    );
    for (const [routeId, m] of Object.entries(byRoute ?? {})) {
      if (!m) continue;
      lines.push(
        `| ${routeId} | ${fmt(m.parse_ok_rate)} | ${fmt(m.render_ok_rate)} | ${
          fmt(m.convergence_rate)
        } | ${
          m.visual_score_mean === null || m.visual_score_mean === undefined
            ? 'n/a'
            : fmt(m.visual_score_mean)
        } |`,
      );
    }
    lines.push('');
  }

  // Per-prompt detail.
  lines.push('## Per-prompt detail');
  lines.push('');
  lines.push(
    '| Prompt | Category | Complexity | A render | B render | C render |',
  );
  lines.push(
    '| ------ | -------- | ---------- | -------- | -------- | -------- |',
  );
  const promptIds = [...new Set(report.records.map(r => r.prompt_id))].sort();
  for (const pid of promptIds) {
    const aRecs = report.records.filter(r =>
      r.prompt_id === pid && r.route === 'A'
    );
    const bRecs = report.records.filter(r =>
      r.prompt_id === pid && r.route === 'B'
    );
    const cRecs = report.records.filter(r =>
      r.prompt_id === pid && r.route === 'C'
    );
    const first = report.records.find(r => r.prompt_id === pid);
    const cat = first?.prompt_category ?? '?';
    const cpx = first?.prompt_complexity ?? '?';
    lines.push(
      `| ${pid} | ${cat} | ${cpx} | ${renderCellOf(aRecs)} | ${
        renderCellOf(bRecs)
      } | ${renderCellOf(cRecs)} |`,
    );
  }
  lines.push('');

  // Failure analysis: top 5 errors per route.
  lines.push('## Failure analysis (top error patterns per route)');
  lines.push('');
  for (const routeId of ['A', 'B', 'C'] as const) {
    const failures = report.records
      .filter(r => r.route === routeId && !r.render_ok && r.error_log)
      .map(r => firstLine(r.error_log));
    if (failures.length === 0) {
      lines.push(`### Route ${routeId} — no failures (or all dry-run).`);
      lines.push('');
      continue;
    }
    const counts = new Map<string, number>();
    for (const e of failures) {
      const key = bucketError(e);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    lines.push(`### Route ${routeId}`);
    lines.push('');
    lines.push('| Count | Pattern |');
    lines.push('| ----- | ------- |');
    for (const [pat, n] of top) {
      lines.push(`| ${n} | ${escapePipes(pat)} |`);
    }
    lines.push('');
  }

  // Recommendation: trigger if one route's render_ok_rate exceeds others by >= 20pp
  const renderOkByRoute = Object.entries(report.summary)
    .filter((e): e is [string, RouteMetrics] => e[1] !== undefined)
    .map(([k, v]) => ({ route: k, value: v.render_ok_rate }));
  if (renderOkByRoute.length >= 2) {
    const sorted = [...renderOkByRoute].sort((a, b) => b.value - a.value);
    const top = sorted[0];
    const next = sorted[1];
    if (top && next && top.value - next.value >= 0.2) {
      lines.push('## Recommendation');
      lines.push('');
      lines.push(
        `Route **${top.route}** leads on render_ok by ${
          fmt(top.value - next.value)
        } over the runner-up (route ${next.route}). This is the route the data supports continuing with into Phase 2.`,
      );
      lines.push('');
    }
  }

  // Caveats / blockers section.
  const hasVisualScores = report.records.some(r =>
    r.visual_score !== null && r.visual_score !== undefined
  );
  if (!hasVisualScores) {
    lines.push('## Caveats');
    lines.push('');
    lines.push(
      '- **Visual scoring not measured.** All `visual_score` values are null. '
        + 'This is expected when running with `--dry-run` (no real LLM calls) or '
        + 'when `ANTHROPIC_API_KEY` is unset. M1/M2/M3 metrics are still '
        + 'meaningful; M4 is absent from the aggregate.',
    );
    lines.push('');
  }

  return lines.join('\n');
}

function renderCellOf(recs: BenchmarkRecord[]): string {
  if (recs.length === 0) return '—';
  const passing = recs.find(r => r.render_ok);
  if (passing) return `✅ (r${passing.round})`;
  return `❌ (${recs.length}r)`;
}

function firstLine(s: string): string {
  const i = s.indexOf('\n');
  return (i >= 0 ? s.slice(0, i) : s).trim();
}

function bucketError(s: string): string {
  // Collapse line numbers, hex ids, and timestamps to make similar errors
  // bucket together.
  return s
    .replace(/\b\d{2,}\b/g, '<N>')
    .replace(/0x[0-9a-f]+/gi, '<HEX>')
    .slice(0, 120);
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|');
}

function fmt(n: number): string {
  return n.toFixed(3);
}

// Streaming JSONL writer kept as an alternative to fs.appendFile, exported for
// future hot loops. Currently unused in the harness above (appendFile is fine
// at Phase-1 scale, and it preserves crash-recoverability semantics).
export function createJsonlWriter(path: string): {
  write: (rec: BenchmarkRecord) => void;
  close: () => Promise<void>;
} {
  const stream = createWriteStream(path, { flags: 'a' });
  return {
    write(rec: BenchmarkRecord): void {
      stream.write(JSON.stringify(rec) + '\n');
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        stream.end((err: Error | null | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
