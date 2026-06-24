#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createA2UICatalog,
  extractCatalogComponentsFromTypeDocJson,
  extractCatalogFunctionsFromTypeDocJson,
  findCatalogSourceFiles,
  writeA2UICatalog,
  writeCatalogArtifacts,
  writeCatalogComponents,
} from './core.js';
import type { TypeDocProject } from './core.js';

interface CliOptions {
  catalogId?: string;
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
  --out-dir <dir>      Output root directory for catalog artifacts.
  --catalog-id <id>    Catalog ID written to the full catalog.json file.
  --version            Print the package version.
  --help               Print this help message.

Defaults:
  --catalog-dir src/catalog
  --out-dir dist
`;

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    catalogDirs: [],
    help: false,
    outDir: 'dist',
    sourceInputs: [],
    version: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    switch (arg) {
      case 'catalog-extractor':
        break;
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
      case '--catalog-id':
        options.catalogId = readValue(args, ++index, arg);
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
  cwd: string = process.cwd(),
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
    const functions = extractCatalogFunctionsFromTypeDocJson(project, {
      cwd,
    });

    writeCatalogComponents(components, {
      cwd,
      outDir: options.outDir,
    });
    writeA2UICatalog(
      createA2UICatalog({
        catalogId: options.catalogId ?? 'catalog.json',
        components,
        functions,
      }),
      {
        cwd,
        outDir: options.outDir,
      },
    );
    printGeneratedComponents(components);
    printGeneratedFunctions(functions);
    return 0;
  }

  const configuredInputs = [
    ...options.sourceInputs,
    ...options.catalogDirs,
  ];
  const inputs = configuredInputs.length > 0
    ? configuredInputs
    : ['src/catalog'];

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

  const { components, functions } = await writeCatalogArtifacts({
    cwd,
    outDir: options.outDir,
    sourceFiles: uniqueSourceFiles,
    ...(options.catalogId ? { catalogId: options.catalogId } : {}),
  });

  printGeneratedComponents(components);
  printGeneratedFunctions(functions);

  // Fail loudly if we matched source files but emitted no artifacts —
  // this used to silently succeed on Windows when TypeDoc rejected
  // backslash entry-point paths, and downstream packages then failed
  // to import the missing `catalog.json` files.
  if (components.length === 0 && functions.length === 0) {
    console.error(
      `[a2ui-catalog-extractor] Found ${uniqueSourceFiles.length} `
        + `source file(s) but emitted 0 component catalogs and 0 `
        + `function definitions. Make sure each catalog props interface `
        + `is annotated with \`@a2uiCatalog <Name>\` and each function `
        + `is annotated with \`@a2uiFunction <name>\`.`,
    );
    return 1;
  }

  return 0;
}

function printGeneratedComponents(components: { name: string }[]): void {
  console.info(`Generated ${components.length} A2UI component catalog files.`);
  for (const component of components) {
    console.info(`Generated strict schema for ${component.name}`);
  }
}

function printGeneratedFunctions(functions: { name: string }[]): void {
  if (functions.length === 0) return;
  console.info(`Generated ${functions.length} A2UI function definitions.`);
  for (const fn of functions) {
    console.info(`Generated function definition for ${fn.name}`);
  }
}

function readValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${option}.`);
  }
  return value;
}

function isEntryScript(): boolean {
  if (!process.argv[1]) return false;
  const entryUrl = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryUrl) return true;
  // The published bin shim does `import '../dist/cli.js'`. In that case the
  // entry script is the bin shim, not this module — but we should still run.
  return /[/\\]bin[/\\]a2ui-catalog-extractor\.[mc]?js$/.test(
    process.argv[1],
  );
}

try {
  if (isEntryScript()) {
    process.exitCode = await runCli(process.argv.slice(2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
