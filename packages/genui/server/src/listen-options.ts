// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const DEFAULT_PORT = 3_000;
const DEFAULT_HOST = '0.0.0.0';

export interface ListenOptions {
  hostname: string;
  port: number;
}

function readPort(value: string | undefined, variableName: string): number {
  if (value === undefined) return DEFAULT_PORT;

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
    port: readPort(env.PORT, 'PORT'),
  };
}
