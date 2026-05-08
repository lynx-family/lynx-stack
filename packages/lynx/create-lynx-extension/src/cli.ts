#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline';

import type { CreateLynxExtensionOptions, ExtensionType } from './index.js';
import {
  EXTENSION_TYPES,
  createLynxExtension,
  parseExtensionTypes,
} from './index.js';

interface CliOptions {
  dir?: string;
  types?: ExtensionType[];
  packageName?: string;
  androidPackage?: string;
  moduleName?: string;
  elementName?: string;
  serviceName?: string;
  help: boolean;
}

/**
 * Parses command-line arguments for the extension scaffold CLI.
 */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === undefined) {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--dir' || arg === '-d') {
      options.dir = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--types') {
      options.types = parseExtensionTypes(readValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg === '--package-name') {
      options.packageName = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--android-package') {
      options.androidPackage = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--module-name') {
      options.moduleName = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--element-name') {
      options.elementName = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--service-name') {
      options.serviceName = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option "${arg}"`);
    }

    if (options.dir !== undefined) {
      throw new Error(`Unexpected positional argument "${arg}"`);
    }

    options.dir = arg;
  }

  return options;
}

/**
 * Reads the value that follows a CLI option and rejects missing flag-like values.
 */
function readValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];

  if (value === undefined || value.startsWith('-')) {
    throw new Error(`${option} requires a value`);
  }

  return value;
}

/**
 * Prints usage information for the extension scaffold CLI.
 */
function printHelp(): void {
  console.info(`Usage: create-lynx-extension [dir] [options]

Options:
  --dir, -d <dir>              Target directory.
  --types <list>               Comma-separated list: native-module,element,service.
  --package-name <name>        npm package name.
  --android-package <name>     Android package name for lynx.ext.json.
  --module-name <name>         Native module class name.
  --element-name <name>        Element tag name.
  --service-name <name>        Service class name.
  --help, -h                   Show this help message.
`);
}

/**
 * Prompts for required scaffold options when the CLI is attached to a TTY.
 */
async function fillInteractiveOptions(
  options: CliOptions,
): Promise<CliOptions> {
  const next: CliOptions = { ...options };
  const needsPrompt = next.dir === undefined
    || next.types === undefined
    || next.types.length === 0;

  if (!needsPrompt) {
    return next;
  }

  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      'Missing required options: --dir and --types are required in non-interactive mode',
    );
  }

  const rl = readline.createInterface({ input, output });

  try {
    if (next.dir === undefined) {
      const answer = await ask(rl, 'Target directory: ');
      next.dir = answer.trim();
    }

    if (next.types === undefined || next.types.length === 0) {
      const answer = await ask(
        rl,
        `Extension types (${EXTENSION_TYPES.join(', ')}): `,
      );
      next.types = parseExtensionTypes(answer.trim());
    }

    return next;
  } finally {
    rl.close();
  }
}

/**
 * Wraps readline questions in a promise for async CLI flow.
 */
function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * Runs the scaffold command from parsed and interactive CLI options.
 */
async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    printHelp();
    return;
  }

  const options = await fillInteractiveOptions(parsed);

  if (options.dir === undefined || options.dir.trim().length === 0) {
    throw new Error('Target directory is required');
  }

  if (options.types === undefined || options.types.length === 0) {
    throw new Error('At least one extension type is required');
  }

  const createOptions: CreateLynxExtensionOptions = {
    dir: path.resolve(options.dir),
    types: options.types,
  };

  if (options.packageName !== undefined) {
    createOptions.packageName = options.packageName;
  }
  if (options.androidPackage !== undefined) {
    createOptions.androidPackage = options.androidPackage;
  }
  if (options.moduleName !== undefined) {
    createOptions.moduleName = options.moduleName;
  }
  if (options.elementName !== undefined) {
    createOptions.elementName = options.elementName;
  }
  if (options.serviceName !== undefined) {
    createOptions.serviceName = options.serviceName;
  }

  const files = createLynxExtension(createOptions);

  console.info(`Created ${files.length} files in ${createOptions.dir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
