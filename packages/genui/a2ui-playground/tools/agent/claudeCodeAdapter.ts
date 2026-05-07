// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { resolveProvider } from './providerResolver.js';
import type { AgentActiveRun, ClaudeCodeTextRunOptions } from './types.js';

interface PreparedTextRun {
  activeRun: AgentActiveRun;
  start: () => void;
}

interface ChildProcessEvents {
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'close', listener: (code: number | null) => void): void;
}

function extractAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  if (!message || typeof message !== 'object') {
    return null;
  }

  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .filter((item): item is { type?: unknown; text?: unknown } =>
      !!item && typeof item === 'object'
    )
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text as string)
    .join('');

  return text || null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.result === 'string' && record.result) {
    return record.result;
  }

  if (typeof record.error === 'string' && record.error) {
    return record.error;
  }

  const assistantText = extractAssistantText(payload);
  return assistantText ?? null;
}

export function createClaudeCodeAdapter() {
  return {
    prepareTextRun(options: ClaudeCodeTextRunOptions): PreparedTextRun {
      const runId = `claude_run_${randomUUID()}`;
      let killProcess: (() => void) | null = null;
      let stopped = false;
      let completed = false;
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let lastAssistantText = '';
      let pendingAssistantError: string | null = null;

      const finalize = (callback: () => void) => {
        if (completed) {
          return;
        }

        completed = true;
        callback();
      };

      const emitAssistantDelta = (nextText: string) => {
        if (!nextText) {
          return;
        }

        if (nextText.startsWith(lastAssistantText)) {
          const delta = nextText.slice(lastAssistantText.length);
          if (delta) {
            options.onDelta(delta);
          }
        } else {
          options.onDelta(nextText);
        }

        lastAssistantText = nextText;
      };

      const processJsonLine = (line: string) => {
        if (!line.trim()) {
          return;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(line);
        } catch {
          return;
        }

        if (!payload || typeof payload !== 'object') {
          return;
        }

        const record = payload as Record<string, unknown>;
        const type = record.type;

        if (type === 'system') {
          options.onStatus?.(payload);
          return;
        }

        if (type === 'assistant') {
          const assistantText = extractAssistantText(payload);
          if (record.error) {
            pendingAssistantError = extractErrorMessage(payload);
            return;
          }

          if (assistantText) {
            emitAssistantDelta(assistantText);
          }
          return;
        }

        if (type === 'result') {
          const isError = record.is_error === true;
          if (isError) {
            const message = extractErrorMessage(payload)
              ?? pendingAssistantError
              ?? 'Claude Code request failed.';
            finalize(() => options.onError(new Error(message)));
            return;
          }

          const resultText = typeof record.result === 'string'
            ? record.result
            : (lastAssistantText === '' ? null : lastAssistantText);
          finalize(() => options.onDone({ resultText }));
        }
      };

      const flushStdoutBuffer = () => {
        let newlineIndex = stdoutBuffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex);
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
          processJsonLine(line);
          newlineIndex = stdoutBuffer.indexOf('\n');
        }
      };

      return {
        activeRun: {
          runId,
          stop() {
            if (stopped || completed) {
              return false;
            }

            stopped = true;
            if (!killProcess) {
              return true;
            }

            killProcess();
            return true;
          },
        },

        start() {
          const provider = resolveProvider();
          if (provider.provider !== 'claude_code' || !provider.binaryPath) {
            finalize(() => {
              options.onError(
                new Error(
                  provider.reason ?? 'Claude Code provider unavailable.',
                ),
              );
            });
            return;
          }

          const args = [
            '-p',
            '--verbose',
            '--output-format',
            'stream-json',
            '--include-partial-messages',
            '--permission-mode',
            'bypassPermissions',
            '--allowedTools',
            '',
            '--no-session-persistence',
          ];

          const childProcess = spawn(provider.binaryPath, args, {
            cwd: options.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env,
          });
          const childProcessEvents =
            childProcess as unknown as ChildProcessEvents;
          killProcess = () => {
            childProcess.kill('SIGTERM');
            setTimeout(() => {
              if (!completed) {
                childProcess.kill('SIGKILL');
              }
            }, 1000);
          };

          childProcess.stdout.on('data', (chunk: Buffer | string) => {
            stdoutBuffer += chunk.toString();
            flushStdoutBuffer();
          });

          childProcess.stderr.on('data', (chunk: Buffer | string) => {
            stderrBuffer += chunk.toString();
          });

          childProcessEvents.on('error', (error: Error) => {
            finalize(() => options.onError(error));
          });

          childProcessEvents.on('close', (code: number | null) => {
            if (stdoutBuffer.trim()) {
              processJsonLine(stdoutBuffer.trim());
              stdoutBuffer = '';
            }

            if (completed) {
              return;
            }

            if (stopped) {
              finalize(() =>
                options.onError(new Error('Claude Code run terminated.'))
              );
              return;
            }

            if (code === 0) {
              finalize(() =>
                options.onDone({ resultText: lastAssistantText || null })
              );
              return;
            }

            const trimmedStderr = stderrBuffer.trim();
            const fallbackMessage = trimmedStderr.length > 0
              ? trimmedStderr
              : (pendingAssistantError
                ?? 'Claude Code process exited unexpectedly.');
            finalize(() => options.onError(new Error(fallbackMessage)));
          });

          childProcess.stdin.end(`${options.prompt}\n`);
        },
      };
    },
  };
}
