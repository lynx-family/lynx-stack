// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VisualEvaluationError } from './errors.js';
import type {
  RunVisualEvaluationOptions,
  VisualEvaluationErrorResponse,
  VisualEvaluationRequest,
  VisualEvaluationResponse,
} from './types.js';

interface ChildResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
}

export async function runVisualEvaluation(
  body: VisualEvaluationRequest,
  options: RunVisualEvaluationOptions = {},
): Promise<VisualEvaluationResponse> {
  assertNoTypeScriptHooks(options);

  const workspace = await mkdtemp(join(tmpdir(), 'ui-judge-'));
  const requestFile = join(workspace, 'request.json');
  const resultFile = join(workspace, 'result.json');

  try {
    await writeFile(requestFile, JSON.stringify(body), 'utf8');
    const child = await runRustVisualEvaluation(
      requestFile,
      resultFile,
      options,
    );
    const result = await readRustResult(resultFile, child);
    if (isVisualEvaluationErrorResponse(result)) {
      throw new VisualEvaluationError(
        result.status,
        result.code,
        result.message,
      );
    }
    if (child.code !== 0) {
      throw rustProcessError(child);
    }
    return result as VisualEvaluationResponse;
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
}

async function runRustVisualEvaluation(
  requestFile: string,
  resultFile: string,
  options: RunVisualEvaluationOptions,
): Promise<ChildResult> {
  const rustArgs = [
    'visual-evaluation',
    '--request-file',
    requestFile,
    '--result-file',
    resultFile,
  ];
  const agent = options.agent;
  if (agent?.apiKey) rustArgs.push('--api-key', agent.apiKey);
  if (agent?.baseURL) rustArgs.push('--base-url', agent.baseURL);
  if (agent?.model) rustArgs.push('--model', agent.model);
  if (agent?.api) rustArgs.push('--api', agent.api);

  const binary = process.env['UI_JUDGE_BIN'];
  const command = binary ?? 'cargo';
  const args = binary
    ? rustArgs
    : [
      'run',
      '--quiet',
      '-p',
      'ui_judge',
      '--bin',
      'ui-judge',
      '--',
      ...rustArgs,
    ];
  const cwd = binary ? process.cwd() : findWorkspaceRoot();

  return await new Promise<ChildResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      resolve({ code, signal, stderr, stdout });
    });
  });
}

async function readRustResult(
  resultFile: string,
  child: ChildResult,
): Promise<VisualEvaluationResponse | VisualEvaluationErrorResponse> {
  let content: string;
  try {
    content = await readFile(resultFile, 'utf8');
  } catch {
    throw rustProcessError(child);
  }

  try {
    return JSON.parse(content) as
      | VisualEvaluationResponse
      | VisualEvaluationErrorResponse;
  } catch {
    throw new VisualEvaluationError(
      500,
      'VISUAL_EVALUATION_ERROR',
      'Rust UI Judge returned invalid JSON.',
    );
  }
}

function findWorkspaceRoot(): string {
  const configured = process.env['UI_JUDGE_WORKSPACE_ROOT'];
  if (configured) return configured;

  let current = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 12; depth++) {
    if (existsSync(join(current, 'packages/genui/ui-judge/rust/src/lib.rs'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

function assertNoTypeScriptHooks(options: RunVisualEvaluationOptions): void {
  const legacyOptions = options as RunVisualEvaluationOptions & {
    evaluate?: unknown;
    fetch?: unknown;
  };
  const customAgent = options.agent as
    | (NonNullable<RunVisualEvaluationOptions['agent']> & { agent?: unknown })
    | undefined;
  if (legacyOptions.evaluate || legacyOptions.fetch || customAgent?.agent) {
    throw new VisualEvaluationError(
      400,
      'INVALID_REQUEST',
      'Custom TypeScript visual-evaluation hooks are no longer supported; configure the Rust model client instead.',
    );
  }
}

function isVisualEvaluationErrorResponse(
  value: unknown,
): value is VisualEvaluationErrorResponse {
  return typeof value === 'object'
    && value !== null
    && (value as { ok?: unknown }).ok === false
    && typeof (value as { status?: unknown }).status === 'number'
    && typeof (value as { code?: unknown }).code === 'string'
    && typeof (value as { message?: unknown }).message === 'string';
}

function rustProcessError(child: ChildResult): VisualEvaluationError {
  const detail = child.stderr.trim()
    || child.stdout.trim()
    || (child.signal
      ? `Rust UI Judge was terminated by ${child.signal}.`
      : `Rust UI Judge exited with code ${child.code ?? 'unknown'}.`);
  return new VisualEvaluationError(500, 'VISUAL_EVALUATION_ERROR', detail);
}
