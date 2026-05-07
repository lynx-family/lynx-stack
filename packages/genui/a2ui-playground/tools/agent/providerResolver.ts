// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawnSync } from 'node:child_process';

import type { ResolvedProvider } from './types.js';

const CLAUDE_CODE_CANDIDATES = [
  process.env.CLAUDE_CODE_BIN,
  'claude',
  'claude-code',
].filter((value): value is string => typeof value === 'string' && value !== '');

function trimOutput(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ?? null;
}

export function detectClaudeCodeBinary(): string | null {
  for (const candidate of CLAUDE_CODE_CANDIDATES) {
    const result = spawnSync('which', [candidate], {
      encoding: 'utf8',
    });

    if (result.status === 0) {
      const resolved = trimOutput(result.stdout);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

export function checkClaudeCodeAvailability(
  binaryPath: string,
): ResolvedProvider {
  const result = spawnSync(binaryPath, ['--version'], {
    encoding: 'utf8',
  });

  if (result.error) {
    return {
      status: 'unavailable',
      provider: null,
      reason: result.error.message,
      version: null,
      binaryPath,
    };
  }

  if (result.status !== 0) {
    const reason = trimOutput(result.stderr)
      ?? trimOutput(result.stdout)
      ?? `Claude Code exited with status ${String(result.status)}`;
    return {
      status: 'unavailable',
      provider: null,
      reason,
      version: null,
      binaryPath,
    };
  }

  return {
    status: 'ready',
    provider: 'claude_code',
    reason: null,
    version: trimOutput(result.stdout) ?? trimOutput(result.stderr),
    binaryPath,
  };
}

export function resolveProvider(): ResolvedProvider {
  const binaryPath = detectClaudeCodeBinary();

  if (!binaryPath) {
    return {
      status: 'unavailable',
      provider: null,
      reason: 'Claude Code CLI was not found on PATH.',
      version: null,
      binaryPath: null,
    };
  }

  return checkClaudeCodeAvailability(binaryPath);
}
