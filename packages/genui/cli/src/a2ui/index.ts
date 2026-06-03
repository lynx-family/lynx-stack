// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { runA2UICreateCli } from './create.js';
import { printPackageVersion, readValue } from '../utils.js';

const a2uiUsage = `Usage: genui a2ui <command> [options]

Commands:
  create [project-name]  Create a new A2UI project from a template.
  generate <target>      Generate catalog artifacts or system prompts.

Targets (for generate):
  catalog  Generate A2UI component and function catalog files.
  prompt   Generate an A2UI system prompt from catalog files.
`;

const legacyA2UIUsage = a2uiUsage.replaceAll('genui a2ui', 'a2ui-cli');

function createGenerateCatalogUsage(programName: string): string {
  return `Usage: ${programName} generate catalog [options]

Options:
  --catalog-dir <dir>  Directory to scan for TypeScript catalog interfaces.
  --source <path>      Source file or directory to scan. Repeatable.
  --typedoc-json <file>
                       Read an existing TypeDoc JSON project instead of
                       running TypeDoc conversion.
  --out-dir <dir>      Output directory for component catalog.json files.
  --version            Print the package version.
  --help               Print this help message.

Defaults:
  --catalog-dir src/catalog
  --out-dir dist/catalog
`;
}

function createGeneratePromptUsage(programName: string): string {
  return `Usage: ${programName} generate prompt [options]

Options:
  --catalog-dir <dir>  Directory containing generated catalog files. When
                       omitted, use the built-in A2UI basic catalog.
  --catalog-id <id>    Catalog id to require in createSurface messages.
  --out <file>         Write the prompt to a file instead of stdout.
  --appendix <text>    Append extra instructions to the generated prompt.
  --version            Print the package version.
  --help               Print this help message.

Defaults:
  --catalog-id built-in A2UI basic catalog id
`;
}

interface A2UIOptions {
  programName: string;
}

interface GeneratePromptOptions {
  help: boolean;
  version: boolean;
  catalogDir?: string;
  catalogId?: string;
  out?: string;
  appendix?: string;
}

export async function runA2UICli(
  args: string[],
  cwd: string,
  options: A2UIOptions,
): Promise<number> {
  const programName = options.programName;
  const command = args[0];
  if (command === undefined || command === '--help' || command === '-h') {
    console.info(programName === 'a2ui-cli' ? legacyA2UIUsage : a2uiUsage);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    printPackageVersion();
    return 0;
  }
  if (command === 'create') {
    return runA2UICreateCli(args.slice(1), cwd, { programName });
  }
  if (command !== 'generate') {
    throw new Error(`Unknown A2UI command: ${command}`);
  }
  const target = args[1];
  const targetArgs = args.slice(2);
  if (target === undefined || target === '--help' || target === '-h') {
    console.info(programName === 'a2ui-cli' ? legacyA2UIUsage : a2uiUsage);
    return 0;
  }
  if (target === '--version' || target === '-v') {
    printPackageVersion();
    return 0;
  }
  if (target === 'catalog') {
    if (targetArgs.includes('--help') || targetArgs.includes('-h')) {
      console.info(createGenerateCatalogUsage(programName));
      return 0;
    }
    const { runCli: runCatalogExtractorCli } = await import(
      '@lynx-js/genui-a2ui-catalog-extractor/cli'
    );
    return await runCatalogExtractorCli(targetArgs, cwd);
  }
  if (target === 'prompt') {
    return runGeneratePromptCli(targetArgs, cwd, { programName });
  }
  throw new Error(`Unknown generate target: ${target}`);
}

async function runGeneratePromptCli(
  args: string[],
  cwd: string,
  cliOptions: A2UIOptions,
): Promise<number> {
  const programName = cliOptions.programName;
  const options = parseGeneratePromptArgs(args);
  if (options.help) {
    console.info(createGeneratePromptUsage(programName));
    return 0;
  }
  if (options.version) {
    printPackageVersion();
    return 0;
  }

  const {
    BASIC_CATALOG,
    BASIC_CATALOG_ID,
    buildA2UISystemPrompt,
    readA2UICatalogFromDirectory,
  } = await import('@lynx-js/genui-a2ui-prompt');
  const catalog = options.catalogDir
    ? readA2UICatalogFromDirectory({
      catalogDir: options.catalogDir,
      catalogId: options.catalogId ?? BASIC_CATALOG_ID,
      cwd,
    })
    : (options.catalogId
      ? { ...BASIC_CATALOG, id: options.catalogId }
      : undefined);
  if (options.catalogDir && catalog && isEmptyCatalog(catalog)) {
    throw new Error(
      `[${programName}] No components or functions found in generated catalog directory: ${options.catalogDir}`,
    );
  }
  const systemPrompt = buildA2UISystemPrompt({
    ...(catalog ? { catalog } : {}),
    ...(options.appendix ? { appendix: options.appendix } : {}),
  });

  if (options.out) {
    const outPath = path.resolve(cwd, options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, systemPrompt);
    console.info(`Generated A2UI system prompt at ${options.out}.`);
  } else {
    process.stdout.write(systemPrompt);
  }

  return 0;
}

function parseGeneratePromptArgs(args: string[]): GeneratePromptOptions {
  const options: GeneratePromptOptions = {
    help: false,
    version: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    switch (arg) {
      case '--catalog-dir':
        options.catalogDir = readValue(args, ++index, arg);
        break;
      case '--catalog-id':
        options.catalogId = readValue(args, ++index, arg);
        break;
      case '--out':
        options.out = readValue(args, ++index, arg);
        break;
      case '--appendix':
        options.appendix = readValue(args, ++index, arg);
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

function isEmptyCatalog(
  catalog: { components?: unknown[]; functions?: unknown[] },
): boolean {
  return (!Array.isArray(catalog.components) || catalog.components.length === 0)
    && (!Array.isArray(catalog.functions) || catalog.functions.length === 0);
}
