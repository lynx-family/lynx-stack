// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { runBenchmark } from './src/harness.ts';
import { ROUTES } from './src/routes/registry.ts';
import type { CorpusEntry, RouteId } from './src/types.ts';

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
  model: string;
  out: string;
  concurrency: number;
  dryRun: boolean;
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
      out: { type: 'string' },
      concurrency: { type: 'string', default: '4' },
      'dry-run': { type: 'boolean', default: false },
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

  const out = values.out
    ? resolvePath(process.cwd(), String(values.out))
    : resolvePath(__dirname, 'reports', `run-${timestampSlug(new Date())}`);

  return {
    routes,
    prompts,
    rounds,
    model: String(values.model),
    out,
    concurrency,
    dryRun: Boolean(values['dry-run']),
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
  --model claude-opus-4-7  Model id (default claude-opus-4-7)
  --out <dir>              Output directory (default benchmarks/reports/run-<ts>)
  --concurrency 4          Number of (prompt, route) cells in flight (default 4)
  --dry-run                Skip live LLM calls; use stub routes
  -h, --help               Show this help

Examples:
  pnpm -F @lynx-js/dom-shim benchmark --dry-run --routes A --prompts P001
  pnpm -F @lynx-js/dom-shim benchmark --all --rounds 3
`,
  );
}

async function main(): Promise<void> {
  let flags: ParsedFlags;
  try {
    flags = parseFlags(process.argv.slice(2));
  } catch (err) {
    if (err instanceof Error && err.message === '__HELP__') return;
    throw err;
  }

  console.info(
    `▶  Running benchmark — routes=${
      flags.routes.join(',')
    } prompts=${flags.prompts.length} rounds=${flags.rounds} dry_run=${flags.dryRun}`,
  );
  console.info(`   model=${flags.model} concurrency=${flags.concurrency}`);
  console.info(`   out=${flags.out}`);

  const report = await runBenchmark(ROUTES, {
    routes: flags.routes,
    prompts: flags.prompts,
    rounds: flags.rounds,
    model_id: flags.model,
    concurrency: flags.concurrency,
    out_dir: flags.out,
    dry_run: flags.dryRun,
  });

  console.info('\n✨ Benchmark finished.');
  console.info(`   Records: ${report.records.length}`);
  console.info(`   Report: ${flags.out}/report.md`);
}

await main();
