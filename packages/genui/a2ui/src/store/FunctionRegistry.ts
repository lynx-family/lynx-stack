// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Function implementations live on the client; the agent only references
 * functions by name. The registry is the bridge from the wire-level
 * `FunctionCall.call` string to the actual code that runs locally.
 */
export type FunctionImpl = (args: Record<string, unknown>) => unknown;

export interface FunctionEntry {
  name: string;
  /** Optional JSON Schema announced to the agent as part of the handshake. */
  schema?: Record<string, unknown>;
  impl: FunctionImpl;
}

export class FunctionRegistry {
  private readonly entries = new Map<string, FunctionEntry>();

  register(entry: FunctionEntry): void {
    this.entries.set(entry.name, entry);
  }

  unregister(name: string): void {
    this.entries.delete(name);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  resolve(name: string): FunctionImpl | undefined {
    return this.entries.get(name)?.impl;
  }

  list(): FunctionEntry[] {
    return Array.from(this.entries.values());
  }
}

export const functionRegistry: FunctionRegistry = new FunctionRegistry();
