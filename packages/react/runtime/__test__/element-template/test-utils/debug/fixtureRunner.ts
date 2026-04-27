import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { format as prettyFormat } from 'pretty-format';
import { expect, it } from 'vitest';

const UPDATE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export interface FixtureContext {
  fixtureName: string;
  fixtureDir: string;
  update: boolean;
  tempDir: string;
}

export interface RunFixtureOptions {
  fixturesRoot: string;
  run: (context: FixtureContext) => Promise<void> | void;
  filter?: string[];
  allowEmpty?: boolean;
}

interface CaseFixtureModule {
  run: (context: { fixtureDir: string; fixtureName: string }) => Promise<unknown> | unknown;
  reportErrorCount?: number;
}

interface CaseFixtureResult {
  output?: unknown;
  files?: Record<string, unknown>;
}

export function isUpdateMode(): boolean {
  const envCandidates = [
    process.env['UPDATE'],
    process.env['UPDATE_SNAPSHOTS'],
    process.env['VITEST_UPDATE'],
  ];
  for (const rawValue of envCandidates) {
    const raw = rawValue?.toLowerCase();
    if (raw && UPDATE_VALUES.has(raw)) {
      return true;
    }
  }

  const argv = process.argv;
  return argv.includes('-u') || argv.includes('--update') || argv.includes('--update-snapshots');
}

export function runFixtureTests({
  fixturesRoot,
  run,
  filter,
  allowEmpty = false,
}: RunFixtureOptions): void {
  if (!fs.existsSync(fixturesRoot)) {
    if (allowEmpty) {
      it.todo('fixtures pending');
      return;
    }
    throw new Error(`Fixtures root not found: ${fixturesRoot}`);
  }

  const fixtures = listFixtureDirs(fixturesRoot);
  const requested = filter ?? parseFixtureFilter();
  const targets = requested.length > 0 ? requested : fixtures;

  if (targets.length === 0) {
    if (allowEmpty) {
      it.todo('fixtures pending');
      return;
    }
    throw new Error('No fixtures found to run.');
  }

  const unknown = targets.filter(name => !fixtures.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown fixtures: ${unknown.join(', ')}`);
  }

  for (const fixtureName of targets) {
    it(`fixture: ${fixtureName}`, async () => {
      const fixtureDir = path.join(fixturesRoot, fixtureName);
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-fixture-'));
      try {
        await run({
          fixtureName,
          fixtureDir,
          update: isUpdateMode(),
          tempDir,
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  }
}

export function runCaseModuleFixtureTests(options: {
  fixturesRoot: string;
  allowEmpty?: boolean;
}): void {
  const { fixturesRoot, allowEmpty = false } = options;

  runFixtureTests({
    fixturesRoot,
    allowEmpty,
    async run({ fixtureDir, fixtureName, update }) {
      const casePath = fs.existsSync(path.join(fixtureDir, 'case.ts'))
        ? path.join(fixtureDir, 'case.ts')
        : path.join(fixtureDir, 'case.tsx');

      if (!fs.existsSync(casePath)) {
        throw new Error(`Missing case file for fixture "${fixtureName}".`);
      }

      const caseModule = (await import(pathToFileURL(casePath).href)) as CaseFixtureModule;
      const reportErrorCount = caseModule.reportErrorCount ?? 0;
      const result = await caseModule.run({ fixtureDir, fixtureName });
      const normalized = normalizeCaseFixtureResult(result);

      expectReportErrorCount(reportErrorCount);
      if (normalized.files) {
        for (const [fileName, value] of Object.entries(normalized.files)) {
          assertOrUpdateTextFile({
            path: path.join(fixtureDir, fileName),
            actual: formatFixtureOutput(value),
            update,
            fixtureName,
            label: fileName,
          });
        }
      }

      const hasOutputFile = normalized.files
        ? Object.prototype.hasOwnProperty.call(normalized.files, 'output.txt')
        : false;
      if (normalized.output !== undefined && !hasOutputFile) {
        assertOrUpdateTextFile({
          path: path.join(fixtureDir, 'output.txt'),
          actual: formatFixtureOutput(normalized.output),
          update,
          fixtureName,
          label: 'output',
        });
      }
    },
  });
}

export function assertOrUpdateTextFile(options: {
  path: string;
  actual: string;
  update: boolean;
  fixtureName: string;
  label: string;
}): void {
  const { path: filePath, actual, update, fixtureName, label } = options;

  if (update) {
    fs.writeFileSync(filePath, actual);
    return;
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label} for fixture "${fixtureName}". Run with UPDATE=1.`);
  }

  const expected = fs.readFileSync(filePath, 'utf8');
  expect(actual).toBe(expected);
}

export function formatFixtureOutput(value: unknown): string {
  return `${prettyFormat(value, { printFunctionName: false })}\n`;
}

export function assertMissingFile(options: {
  path: string;
  update: boolean;
  fixtureName: string;
  label: string;
}): void {
  const { path: filePath, update, fixtureName, label } = options;

  if (update) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }

  if (fs.existsSync(filePath)) {
    throw new Error(`Unexpected ${label} for fixture "${fixtureName}". Run with UPDATE=1.`);
  }
}

export function expectReportErrorCount(expectedCount: number): void {
  const globalErrors = (globalThis as unknown as { __LYNX_REPORT_ERROR_CALLS?: unknown[] })
    .__LYNX_REPORT_ERROR_CALLS ?? [];
  const reportError = (globalThis as unknown as { lynx?: { reportError?: { mock?: { calls: unknown[][] } } } })
    .lynx?.reportError;
  const mockCalls = reportError?.mock?.calls ?? [];

  if (expectedCount === 0) {
    expect(mockCalls.length).toBe(0);
    expect(globalErrors.length).toBe(0);
    resetReportErrorState();
    return;
  }

  const candidates = [] as number[];
  if (mockCalls.length > 0) candidates.push(mockCalls.length);
  if (globalErrors.length > 0) candidates.push(globalErrors.length);
  const actual = candidates.length > 0 ? Math.max(...candidates) : 0;

  expect(actual).toBe(expectedCount);
  resetReportErrorState();
}

export function resetReportErrorState(): void {
  const reportError = (globalThis as unknown as { lynx?: { reportError?: { mockClear?: () => void } } })
    .lynx?.reportError;
  reportError?.mockClear?.();
  (globalThis as unknown as { __LYNX_REPORT_ERROR_CALLS?: unknown[] }).__LYNX_REPORT_ERROR_CALLS = [];
}

function normalizeCaseFixtureResult(result: unknown): CaseFixtureResult {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { output: result };
  }

  const candidate = result as CaseFixtureResult;
  if ('output' in candidate || 'files' in candidate) {
    return {
      output: candidate.output,
      files: candidate.files,
    };
  }

  return { output: result };
}

function listFixtureDirs(fixturesRoot: string): string[] {
  if (!fs.existsSync(fixturesRoot)) {
    throw new Error(`Fixtures root not found: ${fixturesRoot}`);
  }

  const results: string[] = [];

  function hasFixtureFiles(dir: string): boolean {
    return ['case.ts', 'case.tsx', 'index.tsx'].some(fileName => fs.existsSync(path.join(dir, fileName)));
  }

  function walk(dir: string): void {
    if (hasFixtureFiles(dir)) {
      const relative = path.relative(fixturesRoot, dir);
      if (relative && relative !== '.') {
        results.push(relative);
      }
      return;
    }

    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      }
    }
  }

  walk(fixturesRoot);
  return results.sort();
}

function parseFixtureFilter(): string[] {
  const raw = process.env['FIXTURE'];
  if (!raw) return [];
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}
