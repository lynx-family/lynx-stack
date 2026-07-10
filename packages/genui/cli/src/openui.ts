// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { printPackageVersion, readValue } from './utils.js';

const openuiUsage = `Usage: genui openui <command> [options]

Commands:
  generate <target>  Generate OpenUI system prompts.

Targets (for generate):
  prompt             Generate an OpenUI system prompt.
`;

const generatePromptUsage = `Usage: genui openui generate prompt [options]

Options:
  --out <file>       Write the prompt to a file instead of stdout.
  --appendix <text>  Append extra instructions to the generated prompt.
  --version          Print the package version.
  --help             Print this help message.
`;

interface GeneratePromptOptions {
  help: boolean;
  version: boolean;
  out?: string;
  appendix?: string;
}

export async function runOpenUICli(
  args: string[],
  cwd: string,
): Promise<number> {
  const command = args[0];
  if (command === undefined || command === '--help' || command === '-h') {
    console.info(openuiUsage);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    printPackageVersion();
    return 0;
  }
  if (command !== 'generate') {
    throw new Error(`Unknown OpenUI command: ${command}`);
  }

  const target = args[1];
  const targetArgs = args.slice(2);
  if (target === undefined || target === '--help' || target === '-h') {
    console.info(openuiUsage);
    return 0;
  }
  if (target === '--version' || target === '-v') {
    printPackageVersion();
    return 0;
  }
  if (target === 'prompt') {
    return await runGeneratePromptCli(targetArgs, cwd);
  }
  throw new Error(`Unknown OpenUI generate target: ${target}`);
}

async function runGeneratePromptCli(
  args: string[],
  cwd: string,
): Promise<number> {
  const options = parseGeneratePromptArgs(args);
  if (options.help) {
    console.info(generatePromptUsage);
    return 0;
  }
  if (options.version) {
    printPackageVersion();
    return 0;
  }

  const { buildOpenUiSystemPrompt } = await import(
    '../../openui/dist/openui-prompt/index.js'
  );
  const systemPrompt = buildOpenUiSystemPrompt(
    options.appendix ? { appendix: options.appendix } : undefined,
  );

  if (options.out) {
    const outPath = path.resolve(cwd, options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, systemPrompt);
    console.info(`Generated OpenUI system prompt at ${options.out}.`);
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
