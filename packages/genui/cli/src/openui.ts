// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { printPackageVersion } from './utils.js';

const openuiUsage = `Usage: genui openui <command> [options]

OpenUI CLI commands are reserved for future GenUI workflows.
`;

export function runOpenUICli(args: string[]): number {
  const command = args[0];
  if (command === undefined || command === '--help' || command === '-h') {
    console.info(openuiUsage);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    printPackageVersion();
    return 0;
  }
  throw new Error(
    `Unknown OpenUI command: ${command}. OpenUI CLI commands are not available yet.`,
  );
}
