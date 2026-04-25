#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import {
  extractCatalogComponentsFromTypeDocJson,
  findCatalogSourceFiles,
  writeCatalogComponents,
  writeComponentCatalogs,
} from './index.js';
import type { TypeDocProject } from './index.js';

interface CliOptions {
  catalogDirs: string[];
  help: boolean;
  outDir: string;
  sourceInputs: string[];
  typedocJson?: string;
  version: boolean;
}

const usage = `Usage: a2ui-catalog-extractor [options]

Options:
  --catalog-dir <dir>  Directory to scan for TypeScript catalog interfaces.
  --source <path>      Source file or directory to scan. Repeatable.
  --typedoc-json <file>
                       Read an existing TypeDoc JSON project instead of
                       running TypeDoc conversion.
  --out-dir <dir>     Output directory for component catalog.json files.
  --version           Print the package version.
  --help              Print this help message.

Defaults:
  --catalog-dir src/catalog
  --out-dir dist/catalog
`;

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    catalogDirs: [],
    help: false,
    outDir: 'dist/catalog',
    sourceInputs: [],
    version: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    switch (arg) {
      case '--catalog-dir':
        options.catalogDirs.push(readValue(args, ++index, arg));
        break;
      case '--source':
        options.sourceInputs.push(readValue(args, ++index, arg));
        break;
      case '--typedoc-json':
        options.typedocJson = readValue(args, ++index, arg);
        break;
      case '--out-dir':
        options.outDir = readValue(args, ++index, arg);
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--version':
      case '-v':
        options.version = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

export async function runCli(
  args: string[],
  cwd = process.cwd(),
): Promise<number> {
  const options = parseCliArgs(args);

  if (options.help) {
    console.info(usage);
    return 0;
  }

  if (options.version) {
    const require = createRequire(import.meta.url);
    const packageJson = require('../package.json') as { version: string };
    console.info(packageJson.version);
    return 0;
  }

  if (options.typedocJson) {
    const typedocJsonPath = path.resolve(cwd, options.typedocJson);
    const project = JSON.parse(
      fs.readFileSync(typedocJsonPath, 'utf8'),
    ) as TypeDocProject;
    const components = extractCatalogComponentsFromTypeDocJson(project, {
      cwd,
    });

    writeCatalogComponents(components, {
      cwd,
      outDir: options.outDir,
    });
    printGeneratedComponents(components);
    return 0;
  }

  const inputs = options.sourceInputs.length > 0
    ? options.sourceInputs
    : (options.catalogDirs.length > 0
      ? options.catalogDirs
      : ['src/catalog']);

  const sourceFiles = inputs.flatMap(input =>
    findCatalogSourceFiles(path.resolve(cwd, input))
  );
  const uniqueSourceFiles = [...new Set(sourceFiles)].sort((left, right) =>
    left.localeCompare(right)
  );

  if (uniqueSourceFiles.length === 0) {
    throw new Error(
      `No TypeScript source files found in ${inputs.join(', ')}.`,
    );
  }

  const components = await writeComponentCatalogs({
    cwd,
    outDir: options.outDir,
    sourceFiles: uniqueSourceFiles,
  });

  printGeneratedComponents(components);

  return 0;
}

function printGeneratedComponents(components: { name: string }[]): void {
  console.info(`Generated ${components.length} A2UI component catalog files.`);
  for (const component of components) {
    console.info(`Generated strict schema for ${component.name}`);
  }
}

function readValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${option}.`);
  }
  return value;
}

try {
  if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = await runCli(process.argv.slice(2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
