#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { cancel, isCancel, multiselect, text } from '@clack/prompts';

import type { CreateLynxLibraryOptions, LibraryFeature } from './index.js';
import {
  LIBRARY_FEATURES,
  createLynxLibrary,
  parseLibraryFeatures,
} from './index.js';

export interface CliOptions {
  dir?: string;
  features?: LibraryFeature[];
  packageName?: string;
  androidPackage?: string;
  moduleName?: string;
  elementName?: string;
  serviceName?: string;
  help: boolean;
}

export interface CliPrompts {
  text: typeof text;
  multiselect: typeof multiselect;
}

export interface CliRuntime {
  input: Readable & { isTTY?: boolean };
  output: Writable & { isTTY?: boolean };
  info: (message: string) => void;
  error: (message: string) => void;
  prompts?: CliPrompts;
}

const DEFAULT_RUNTIME: CliRuntime = {
  input,
  output,
  info(message) {
    console.info(message);
  },
  error(message) {
    console.error(message);
  },
};
class CliCancelError extends Error {
  override name = 'CliCancelError';
}
const DEFAULT_PROMPTS: CliPrompts = {
  text,
  multiselect,
};
const DEFAULT_PROJECT_NAME = 'lynx-library';
const LIBRARY_FEATURE_LABELS: Record<LibraryFeature, string> = {
  'native-module': 'Native Module',
  element: 'Element',
  service: 'Service',
};
const LIBRARY_FEATURE_HINTS: Record<LibraryFeature, string> = {
  'native-module': 'JS bridge APIs implemented by native code',
  element: 'native UI element registered through Lynx',
  service: 'native service implementation registered globally',
};

/**
 * Parses command-line arguments for the library scaffold CLI.
 */
export function parseArgs(argv: string[]): CliOptions {
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

    if (arg === '--features' || arg === '--feature') {
      options.features = [
        ...(options.features ?? []),
        ...parseLibraryFeatures(readValue(argv, index, arg)),
      ];
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
 * Prints usage information for the library scaffold CLI.
 */
function printHelp(runtime: CliRuntime): void {
  runtime.info(`Usage: create-lynx-library [dir] [options]

Options:
  --dir, -d <dir>              Target directory.
  --feature, --features <list> Comma-separated list or "all".
  --package-name <name>        npm package name.
  --android-package <name>     Android package name for lynx.lib.json.
  --module-name <name>         Native module class name.
  --element-name <name>        Element tag name.
  --service-name <name>        Service class name.
  --help, -h                   Show this help message.

Library features:
  native-module                JS bridge APIs implemented by native code.
  element                      Native UI element registered through Lynx.
  service                      Native service implementation registered globally.

Examples:
  create-lynx-library
  create-lynx-library lynx-button --features native-module,element,service
  create-lynx-library lynx-kit --features all
`);
}

/**
 * Prompts for required scaffold options when the CLI is attached to a TTY.
 */
async function fillInteractiveOptions(
  options: CliOptions,
  runtime: CliRuntime,
): Promise<CliOptions> {
  const next: CliOptions = { ...options };
  const needsPrompt = next.dir === undefined
    || next.features === undefined
    || next.features.length === 0;

  if (!needsPrompt) {
    return next;
  }

  if (!runtime.input.isTTY || !runtime.output.isTTY) {
    const missingOptions: string[] = [];

    if (next.dir === undefined) {
      missingOptions.push('--dir');
    }
    if (next.features === undefined || next.features.length === 0) {
      missingOptions.push('--features');
    }

    throw new Error(
      `Missing required options in non-interactive mode: ${
        missingOptions.join(', ')
      }`,
    );
  }

  const prompts = getPrompts(runtime);

  next.dir ??= checkCancel<string>(
    await prompts.text({
      input: runtime.input,
      output: runtime.output,
      message: 'Project name or path',
      placeholder: DEFAULT_PROJECT_NAME,
      defaultValue: DEFAULT_PROJECT_NAME,
      validate(value) {
        if (value?.trim().length === 0) {
          return 'Project name is required';
        }
        return undefined;
      },
    }),
    runtime,
  ).trim();

  if (next.features === undefined || next.features.length === 0) {
    next.features = checkCancel<LibraryFeature[]>(
      await prompts.multiselect<LibraryFeature>({
        input: runtime.input,
        output: runtime.output,
        message:
          'Select library features (Use <space> to select, <enter> to continue)',
        options: LIBRARY_FEATURES.map((feature) => ({
          value: feature,
          label: LIBRARY_FEATURE_LABELS[feature],
          hint: LIBRARY_FEATURE_HINTS[feature],
        })),
        initialValues: [...LIBRARY_FEATURES],
        required: true,
      }),
      runtime,
    );
  }

  return next;
}

/**
 * Runs the scaffold command from parsed and interactive CLI options.
 */
export async function main(
  argv: string[] = process.argv.slice(2),
  runtime: CliRuntime = DEFAULT_RUNTIME,
): Promise<void> {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    printHelp(runtime);
    return;
  }

  const options = await fillInteractiveOptions(parsed, runtime);

  if (options.dir === undefined || options.dir.trim().length === 0) {
    throw new Error('Target directory is required');
  }

  if (options.features === undefined || options.features.length === 0) {
    throw new Error('At least one library feature is required');
  }

  const createOptions: CreateLynxLibraryOptions = {
    dir: path.resolve(options.dir),
    features: options.features,
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

  const files = createLynxLibrary(createOptions);

  runtime.info(formatSuccessMessage({
    dir: createOptions.dir,
    filesCount: files.length,
    packageManager: detectPackageManager(),
    features: options.features,
  }));
}

/**
 * Reports CLI failures using the same formatting as the executable entry point.
 */
export function reportCliError(
  error: unknown,
  runtime: CliRuntime = DEFAULT_RUNTIME,
): void {
  if (error instanceof CliCancelError) {
    return;
  }

  runtime.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export function isCliEntrypoint(
  entrypoint: string | undefined = process.argv[1],
  moduleUrl: string = import.meta.url,
): boolean {
  return entrypoint !== undefined
    && normalizeEntrypointPath(entrypoint)
      === normalizeEntrypointPath(fileURLToPath(moduleUrl));
}

function normalizeEntrypointPath(filePath: string): string {
  const resolvedPath = path.resolve(filePath);

  try {
    return fs.realpathSync(resolvedPath);
  } catch {
    return resolvedPath;
  }
}

function getPrompts(runtime: CliRuntime): CliPrompts {
  return runtime.prompts ?? DEFAULT_PROMPTS;
}

function checkCancel<T>(value: T | symbol, runtime: CliRuntime): T {
  if (isCancel(value)) {
    cancel('Operation cancelled.', {
      input: runtime.input,
      output: runtime.output,
    });
    throw new CliCancelError();
  }

  return value;
}

function formatSuccessMessage({
  dir,
  filesCount,
  packageManager,
  features,
}: {
  dir: string;
  filesCount: number;
  packageManager: PackageManager;
  features: LibraryFeature[];
}): string {
  // Display library features in the canonical order from LIBRARY_FEATURES.
  const selectedFeatures = LIBRARY_FEATURES.filter((feature) =>
    features.includes(feature)
  );
  const featureSummary = selectedFeatures
    .map((feature) => `  - ${LIBRARY_FEATURE_LABELS[feature]}`)
    .join('\n');
  const nextSteps = [
    `1. cd ${formatTargetDir(dir)}`,
    `2. ${packageManager} install`,
  ];

  if (selectedFeatures.includes('native-module')) {
    nextSteps.push(`3. ${packageManager} run codegen`);
  }

  return `Created ${filesCount} files in ${dir}

Library features:
${featureSummary}

Next steps:
${nextSteps.map((step) => `  ${step}`).join('\n')}`;
}

type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn';

function detectPackageManager(
  userAgent: string | undefined = process.env['npm_config_user_agent'],
): PackageManager {
  const name = userAgent?.split(' ')[0]?.split('/')[0];

  if (name === 'bun' || name === 'pnpm' || name === 'yarn') {
    return name;
  }

  return 'npm';
}

function formatTargetDir(targetDir: string): string {
  const relativePath = path.relative(process.cwd(), targetDir);

  if (relativePath.length === 0) {
    return '.';
  }

  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath;
  }

  return targetDir;
}

/* v8 ignore next 5 */
if (isCliEntrypoint()) {
  main().catch((error: unknown) => {
    reportCliError(error);
  });
}
