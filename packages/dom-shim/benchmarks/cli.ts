// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { runBenchmark } from './src/harness.ts';
import { estimateInputTokens } from './src/llm/anthropic-client.ts';
import { ROUTES } from './src/routes/registry.ts';
import { buildSystemPrompt as buildSystemPromptA } from './src/routes/route-a-papi.ts';
import { SYSTEM_PROMPT as SYSTEM_PROMPT_B } from './src/routes/route-b-shim.ts';
import { SYSTEM_PROMPT as SYSTEM_PROMPT_C } from './src/routes/route-c-a2ui.ts';
import type { BenchmarkReport, CorpusEntry, RouteId } from './src/types.ts';
import { estimateUsdCost, hasPricing } from './src/utils/pricing.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VALID_ROUTES: ReadonlySet<RouteId> = new Set<RouteId>(['A', 'B', 'C']);

function die(msg: string): never {
  console.error(`❌ ${msg}`);
  throw new Error(msg);
}

interface ParsedFlags {
  routes: RouteId[];
  prompts: CorpusEntry[];
  rounds: number;
  /** One or more models. Single-element when --model alone is passed. */
  models: string[];
  /** True iff --models was explicitly used (vs implicit single from --model). */
  multiModel: boolean;
  out: string;
  concurrency: number;
  dryRun: boolean;
  estimateOnly: boolean;
}

function parseFlags(argv: string[]): ParsedFlags {
  const { values } = parseArgs({
    args: argv,
    options: {
      routes: { type: 'string', default: 'A,B,C' },
      prompts: { type: 'string' },
      all: { type: 'boolean', default: false },
      rounds: { type: 'string', default: '3' },
      model: { type: 'string', default: 'claude-opus-4-7' },
      models: { type: 'string' },
      out: { type: 'string' },
      concurrency: { type: 'string', default: '4' },
      'dry-run': { type: 'boolean', default: false },
      'estimate-only': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    printHelp();
    throw new Error('__HELP__');
  }

  const corpus = loadCorpus();

  const routes = String(values.routes)
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0)
    .map(s => {
      if (!VALID_ROUTES.has(s as RouteId)) {
        die(`Invalid route "${s}". Valid: ${[...VALID_ROUTES].join(', ')}`);
      }
      return s as RouteId;
    });
  if (routes.length === 0) die('No routes selected.');

  let prompts: CorpusEntry[];
  if (values.all) {
    prompts = corpus;
  } else if (values.prompts) {
    const ids = String(values.prompts).split(',').map(s => s.trim()).filter(
      Boolean,
    );
    if (ids.length === 0) {
      die('--prompts was empty. Pass --all or a non-empty list.');
    }
    const byId = new Map(corpus.map(p => [p.id, p]));
    prompts = ids.map(id => {
      const found = byId.get(id);
      if (!found) die(`Prompt id "${id}" not found in corpus.`);
      return found;
    });
  } else {
    die('Pass either --all or --prompts P001,P002,...');
  }

  const rounds = Number(values.rounds);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) {
    die(`--rounds must be an integer in [1,10], got ${String(values.rounds)}`);
  }

  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64) {
    die(
      `--concurrency must be an integer in [1,64], got ${
        String(values.concurrency)
      }`,
    );
  }

  // --models takes precedence over --model. Single --model behaves as before.
  const multiModel = Boolean(values.models);
  const models = multiModel
    ? String(values.models)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    : [String(values.model)];
  if (models.length === 0) die('--models was empty.');

  const out = values.out
    ? resolvePath(process.cwd(), String(values.out))
    : resolvePath(__dirname, 'reports', `run-${timestampSlug(new Date())}`);

  return {
    routes,
    prompts,
    rounds,
    models,
    multiModel,
    out,
    concurrency,
    dryRun: Boolean(values['dry-run']),
    estimateOnly: Boolean(values['estimate-only']),
  };
}

function loadCorpus(): CorpusEntry[] {
  const path = resolvePath(__dirname, 'corpus', 'prompts.json');
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    die(`Corpus at ${path} is not an array`);
  }
  return parsed as CorpusEntry[];
}

function timestampSlug(d: Date): string {
  return d.toISOString().replace(/[:.]/g, '-');
}

function printHelp(): void {
  console.info(
    `Usage: pnpm -F @lynx-js/dom-shim benchmark [options]

Options:
  --routes A,B,C           Subset of routes (default A,B,C)
  --prompts P001,P002      Subset of prompts (mutually exclusive with --all)
  --all                    Run all 50 corpus prompts
  --rounds 3               Max LLM rounds per (prompt, route) cell (default 3)
  --model claude-opus-4-7  Single model id (default claude-opus-4-7)
  --models gpt-4o,...      Multi-model sweep (comma-separated; overrides --model)
  --out <dir>              Output directory (default benchmarks/reports/run-<ts>)
  --concurrency 4          Number of (prompt, route) cells in flight (default 4)
  --dry-run                Skip live LLM calls; use stub routes
  --estimate-only          Print estimated cost for the selected sweep and exit 0
                           without calling any LLM
  -h, --help               Show this help

Examples:
  pnpm -F @lynx-js/dom-shim benchmark --dry-run --routes A --prompts P001
  pnpm -F @lynx-js/dom-shim benchmark --all --rounds 3
  pnpm -F @lynx-js/dom-shim benchmark --estimate-only --all --routes A,B,C \\
      --rounds 3 --models gpt-4o,claude-opus-4-7
`,
  );
}

const SYSTEM_PROMPT_BY_ROUTE: Record<RouteId, () => string> = {
  A: buildSystemPromptA,
  B: () => SYSTEM_PROMPT_B,
  C: () => SYSTEM_PROMPT_C,
};

/**
 * Pre-flight estimator: per-route + per-model + per-round upper-bound cost.
 * Uses estimateInputTokens (chars/4) for input; output is bracketed by a
 * conservative [300, 1500] token range per round per route per prompt, which
 * matches the spread observed in the Phase 1 hard n=10 dataset.
 */
function estimateRun(flags: ParsedFlags): {
  perModel: Array<{ model: string; lo: number; mid: number; hi: number }>;
  totals: { lo: number; mid: number; hi: number };
} {
  const perModel: Array<
    { model: string; lo: number; mid: number; hi: number }
  > = [];
  let totalLo = 0;
  let totalMid = 0;
  let totalHi = 0;
  for (const model of flags.models) {
    let inputTokens = 0;
    for (const routeId of flags.routes) {
      const sys = SYSTEM_PROMPT_BY_ROUTE[routeId]();
      for (const prompt of flags.prompts) {
        for (let round = 1; round <= flags.rounds; round++) {
          // Approximate the user prompt: corpus prompt text + capabilities
          // list. For round > 1 the previous generation + error log roughly
          // doubles the user payload, but we pessimistically add a flat
          // ~2000 chars / 500 tokens to keep the estimate honest.
          const userBase = prompt.prompt.length
            + prompt.expected_capabilities.join(',').length
            + 200;
          const roundOverhead = round > 1 ? 2000 : 0;
          inputTokens += estimateInputTokens(
            sys,
            ' '.repeat(userBase + roundOverhead),
          );
        }
      }
    }
    const cells = flags.routes.length * flags.prompts.length * flags.rounds;
    const lo = estimateUsdCost(model, inputTokens, 300 * cells);
    const hi = estimateUsdCost(model, inputTokens, 1500 * cells);
    const mid = (lo + hi) / 2;
    perModel.push({ model, lo, mid, hi });
    totalLo += lo;
    totalMid += mid;
    totalHi += hi;
  }
  return {
    perModel,
    totals: { lo: totalLo, mid: totalMid, hi: totalHi },
  };
}

async function writeCrossModelSummary(
  outDir: string,
  reports: Array<{ model: string; report: BenchmarkReport }>,
): Promise<void> {
  const lines: string[] = [];
  lines.push('# Cross-model summary');
  lines.push('');
  lines.push(
    '| Model | Route | parse_ok | render_ok | convergence | visual_score | tokens (in/out) | cost (USD) |',
  );
  lines.push(
    '| ----- | ----- | -------- | --------- | ----------- | ------------ | --------------- | ---------- |',
  );
  for (const { model, report } of reports) {
    for (const [routeId, m] of Object.entries(report.summary)) {
      if (!m) continue;
      const metrics = m;
      lines.push(
        `| ${model} | ${routeId} | ${metrics.parse_ok_rate.toFixed(3)} | ${
          metrics.render_ok_rate.toFixed(3)
        } | ${metrics.convergence_rate.toFixed(3)} | ${
          metrics.visual_score_mean === null
            || metrics.visual_score_mean === undefined
            ? 'n/a'
            : metrics.visual_score_mean.toFixed(3)
        } | ${metrics.total_input_tokens ?? 0} / ${
          metrics.total_output_tokens ?? 0
        } | ${fmtUsd(metrics.estimated_cost_usd ?? 0)} |`,
      );
    }
  }
  lines.push('');
  await writeFile(
    resolvePath(outDir, 'cross_model_summary.md'),
    lines.join('\n'),
  );
}

function fmtUsd(n: number): string {
  if (n === 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

async function main(): Promise<void> {
  let flags: ParsedFlags;
  try {
    flags = parseFlags(process.argv.slice(2));
  } catch (err) {
    if (err instanceof Error && err.message === '__HELP__') return;
    throw err;
  }

  if (flags.estimateOnly) {
    const est = estimateRun(flags);
    for (const m of est.perModel) {
      const note = hasPricing(m.model)
        ? ''
        : ' (model not in pricing table; estimate=$0)';
      console.info(
        `Estimated cost for ${m.model}: $${m.mid.toFixed(2)} (range $${
          m.lo.toFixed(2)
        }..$${m.hi.toFixed(2)})${note}`,
      );
    }
    if (est.perModel.length > 1) {
      console.info(
        `Estimated cost: $${est.totals.mid.toFixed(2)} (range $${
          est.totals.lo.toFixed(2)
        }..$${est.totals.hi.toFixed(2)})`,
      );
    } else {
      const only = est.perModel[0];
      if (only) {
        console.info(
          `Estimated cost: $${only.mid.toFixed(2)} (range $${
            only.lo.toFixed(2)
          }..$${only.hi.toFixed(2)})`,
        );
      }
    }
    return;
  }

  console.info(
    `▶  Running benchmark — routes=${
      flags.routes.join(',')
    } prompts=${flags.prompts.length} rounds=${flags.rounds} dry_run=${flags.dryRun}`,
  );
  console.info(
    `   models=${flags.models.join(',')} concurrency=${flags.concurrency}`,
  );
  console.info(`   out=${flags.out}`);

  const reports: Array<{ model: string; report: BenchmarkReport }> = [];
  await mkdir(flags.out, { recursive: true });
  for (const model of flags.models) {
    const modelOutDir = flags.multiModel
      ? resolvePath(flags.out, model.replaceAll('/', '-'))
      : flags.out;
    const report = await runBenchmark(ROUTES, {
      routes: flags.routes,
      prompts: flags.prompts,
      rounds: flags.rounds,
      model_id: model,
      concurrency: flags.concurrency,
      out_dir: modelOutDir,
      dry_run: flags.dryRun,
    });
    reports.push({ model, report });
    console.info(`   ✓ ${model}: ${report.records.length} records`);
  }

  if (flags.multiModel) {
    await writeCrossModelSummary(flags.out, reports);
    console.info(
      `   ✓ cross-model summary: ${flags.out}/cross_model_summary.md`,
    );
  }

  console.info('\n✨ Benchmark finished.');
  const total = reports.reduce((s, r) => s + r.report.records.length, 0);
  console.info(`   Total records: ${total} across ${reports.length} model(s)`);
  console.info(`   Out: ${flags.out}`);
}

// Touch readFile so the type-only import isn't dropped by the runtime;
// reserved for future async corpus loading without breaking the existing
// sync path.
void readFile;

await main();
