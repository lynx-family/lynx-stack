#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import type { CodegenOptions } from './index.js';
import { runCodegen } from './index.js';

interface CliOptions {
  root?: string;
  help: boolean;
}

/**
 * Parses command-line arguments for the autolink codegen CLI.
 */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--root' || arg === '-r') {
      const value = argv[index + 1];

      if (value === undefined || value.startsWith('-')) {
        throw new Error(`${arg} requires a value`);
      }

      options.root = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option "${arg ?? ''}"`);
  }

  return options;
}

/**
 * Prints usage information for the autolink codegen CLI.
 */
function printHelp(): void {
  console.info(`Usage: lynx-autolink-codegen [--root <dir>]

Generate Lynx library JS, Android, iOS, and HarmonyOS specs from types/**/*.d.ts.

Options:
  --root, -r <dir>  Library package root. Defaults to the current directory.
  --help, -h        Show this help message.
`);
}

/**
 * Runs code generation from parsed CLI options.
 */
function main(): void {
  const cliOptions = parseArgs(process.argv.slice(2));

  if (cliOptions.help) {
    printHelp();
    return;
  }

  const options: CodegenOptions = {};

  if (cliOptions.root !== undefined) {
    options.root = path.resolve(cliOptions.root);
  }

  const files = runCodegen(options);

  for (const file of files) {
    console.info(`generated ${file.path}`);
  }
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
