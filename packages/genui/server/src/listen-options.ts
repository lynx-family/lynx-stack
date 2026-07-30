// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const DEFAULT_PORT = 3_000;
const DEFAULT_HOST = '::';

export interface ListenOptions {
  hostname: string;
  port: number;
}

function readPort(value: string | undefined, variableName: string): number {
  if (value === undefined) return DEFAULT_PORT;

  if (value.trim() === '') {
    throw new Error(`Invalid ${variableName} value: ${value}`);
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid ${variableName} value: ${value}`);
  }
  return port;
}

export function resolveListenOptions(
  env: Readonly<NodeJS.ProcessEnv>,
): ListenOptions {
  return {
    hostname: env.HOST ?? DEFAULT_HOST,
    port: readPort(env.LYNX_USE_PORT, 'LYNX_USE_PORT'),
  };
}
