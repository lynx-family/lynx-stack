#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  checkCatalogFiles,
  extractCatalog,
  writeCatalogFiles,
} from './extractor.ts';
import type { CatalogFormat, ExtractCatalogOptions } from './types.ts';

function printUsage(): void {
  console.error(
    [
      'Usage:',
      '  a2ui-catalog-extractor generate --source <dir> --out <dir> [--tsconfig <path>] [--format legacy-shards|a2ui-catalog]',
      '  a2ui-catalog-extractor check --source <dir> --out <dir> [--tsconfig <path>] [--format legacy-shards|a2ui-catalog]',
    ].join('\n'),
  );
}

function getCommand(): string | undefined {
  return process.argv[2];
}

function isCatalogFormat(value: string): value is CatalogFormat {
  return value === 'legacy-shards' || value === 'a2ui-catalog';
}

function parseCatalogFormat(rawFormat: string | undefined): CatalogFormat {
  if (!rawFormat) {
    return 'legacy-shards';
  }

  if (isCatalogFormat(rawFormat)) {
    return rawFormat;
  }

  throw new Error(
    `Unsupported --format "${rawFormat}". Expected "legacy-shards" or "a2ui-catalog".`,
  );
}

function parseCatalogOptions(args: readonly string[]): {
  extractOptions: ExtractCatalogOptions;
  outDir: string;
} {
  const { values } = parseArgs({
    args: [...args],
    options: {
      'catalog-id': { type: 'string' },
      component: { multiple: true, type: 'string' },
      description: { type: 'string' },
      format: { type: 'string' },
      out: { type: 'string' },
      schema: { type: 'string' },
      source: { type: 'string' },
      title: { type: 'string' },
      tsconfig: { type: 'string' },
    },
    strict: true,
  });

  if (!values['source'] || !values['out']) {
    throw new Error('Both --source and --out are required.');
  }

  const extractOptions: ExtractCatalogOptions = {
    format: parseCatalogFormat(values['format']),
    sourceDir: values['source'],
  };
  if (values['catalog-id']) extractOptions.catalogId = values['catalog-id'];
  if (values['component']) extractOptions.components = values['component'];
  if (values['description']) extractOptions.description = values['description'];
  if (values['schema']) extractOptions.schema = values['schema'];
  if (values['title']) extractOptions.title = values['title'];
  if (values['tsconfig']) extractOptions.tsconfigPath = values['tsconfig'];

  return {
    extractOptions,
    outDir: values['out'],
  };
}

async function main(): Promise<number> {
  const command = getCommand();
  if (!command || (command !== 'generate' && command !== 'check')) {
    printUsage();
    return 1;
  }

  const { extractOptions, outDir } = parseCatalogOptions(process.argv.slice(3));
  const result = await extractCatalog(extractOptions);

  if (command === 'generate') {
    const files = await writeCatalogFiles(result, { outDir });
    for (const file of files) {
      console.info(`wrote ${file.path}`);
    }
    return 0;
  }

  const checkResult = await checkCatalogFiles(result, { outDir });
  if (!checkResult.ok) {
    for (const file of checkResult.missing) {
      console.error(`missing ${file}`);
    }
    for (const file of checkResult.mismatched) {
      console.error(`mismatch ${file}`);
    }
    return 1;
  }

  console.info('catalog output is up to date');
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
