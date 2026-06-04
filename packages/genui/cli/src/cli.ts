// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { runA2UICli } from './a2ui/index.js';
import { runOpenUICli } from './openui.js';
import { printPackageVersion } from './utils.js';

const usage = `Usage: genui <namespace> <command> [options]

Namespaces:
  a2ui    Generate A2UI catalog artifacts and system prompts.
  openui  Reserved for future OpenUI workflows.

Examples:
  genui a2ui create my-app
  genui a2ui generate catalog --catalog-dir src/catalog --out-dir dist/catalog
  genui a2ui generate prompt --out dist/a2ui-system-prompt.txt
`;

export interface CliOptions {
  binName?: string;
}

export async function runCli(
  args: string[],
  cwd: string = process.cwd(),
  cliOptions: CliOptions = {},
): Promise<number> {
  const binName = cliOptions.binName ?? 'genui';
  if (binName === 'a2ui-cli') {
    return await runA2UICli(args, cwd, { programName: 'a2ui-cli' });
  }

  const command = args[0];
  if (command === undefined || command === '--help' || command === '-h') {
    console.info(usage);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    printPackageVersion();
    return 0;
  }

  if (command === 'a2ui') {
    return await runA2UICli(args.slice(1), cwd, { programName: 'genui a2ui' });
  }
  if (command === 'openui') {
    return runOpenUICli(args.slice(1));
  }

  throw new Error(`Unknown namespace: ${command}`);
}
