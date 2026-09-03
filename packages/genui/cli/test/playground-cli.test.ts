// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runCli } from '../src/cli.js';

describe('genui playground CLI', () => {
  test('documents the public command and options', async () => {
    const messages: string[] = [];
    const original = console.info;
    console.info = (value: unknown) => messages.push(String(value));
    try {
      expect(await runCli(['playground', '--help'])).toBe(0);
    } finally {
      console.info = original;
    }
    expect(messages.join('\n')).toContain('genui playground');
    expect(messages.join('\n')).toContain('--port <number>');
    expect(messages.join('\n')).toContain('--no-open');
    expect(messages.join('\n')).toContain('--data-dir <path>');
  });

  test('rejects unsafe or ambiguous options before daemon startup', async () => {
    await expect(runCli(['playground', '--port', '0'])).rejects.toThrow(
      /between 1 and 65535/,
    );
    await expect(runCli(['playground', '--unknown'])).rejects.toThrow(
      /Unknown playground option/,
    );
  });
});
