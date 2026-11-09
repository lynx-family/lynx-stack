// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { profileEnd, profileStart } from './profile.js';

const maxStringLength = 80;
const maxArgs = 6;

export function truncateDebugString(value: string): string {
  return value.length > maxStringLength ? value.slice(0, maxStringLength) + '…' : value;
}

export function debugValueType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  return Array.isArray(value) ? 'array' : typeof value;
}

export function formatDebugValue(value: unknown, previewStrings: boolean): string {
  switch (typeof value) {
    case 'string':
      return previewStrings ? JSON.stringify(truncateDebugString(value)) : 'string';
    case 'number':
    case 'boolean':
      return String(value);
    default:
      return debugValueType(value);
  }
}

export function formatDebugArgs(args: readonly unknown[], format: (value: unknown) => string): string {
  const summary = args.slice(0, maxArgs).map(value => format(value)).join(', ');
  return args.length > maxArgs ? `${summary}, … (+${args.length - maxArgs})` : summary;
}

export function tryDebugLog(message: () => string): void {
  try {
    console.alog?.(message());
  } catch {
    // A diagnostic sink must not interrupt the operation it observes.
  }
}

export function tryStartDebugProfile(name: string, args?: () => Record<string, string>): boolean {
  try {
    if (args) {
      profileStart(name, { args: args() });
    } else {
      profileStart(name);
    }
    return true;
  } catch {
    return false;
  }
}

export function tryEndDebugProfile(started: boolean): void {
  if (started) {
    try {
      profileEnd();
    } catch {
      // Preserve any exception from the operation being profiled.
    }
  }
}
