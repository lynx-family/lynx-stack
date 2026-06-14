// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Signal } from '@preact/signals';

import type { MessageProcessor } from './MessageProcessor.js';

/**
 * Runtime context passed to client-side function implementations. It mirrors
 * the small DataContext subset used by upstream A2UI basic functions while
 * staying tied to this renderer's `MessageProcessor` + `SignalStore`.
 */
export interface FunctionCallContext {
  processor: MessageProcessor;
  surfaceId: string;
  dataContextPath?: string | undefined;
  resolveDynamicValue(value: unknown): unknown;
  resolveSignal(value: unknown): Signal<unknown>;
  set(path: string, value: unknown): void;
}

/**
 * Function implementations live on the client; the agent only references
 * functions by name. The registry is the bridge from the wire-level
 * `FunctionCall.call` string to the actual code that runs locally.
 */
export type FunctionImpl = (
  args: Record<string, unknown>,
  context?: FunctionCallContext,
) => unknown;

/**
 * Structured definition announced to the agent during catalog handshake.
 * Kept here (in store/) so callers in both `catalog/` and `react/` can
 * share the same shape without importing across the layering boundary.
 */
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  returnType:
    | 'string'
    | 'number'
    | 'boolean'
    | 'array'
    | 'object'
    | 'any'
    | 'void';
}

/**
 * Registered client-side function and its optional handshake definition.
 */
export interface FunctionEntry {
  name: string;
  /** Optional function definition announced to the agent as part of the handshake. */
  definition?: FunctionDefinition | undefined;
  impl: FunctionImpl;
}

/**
 * Lookup table that routes protocol `FunctionCall.call` names to local
 * JavaScript implementations.
 */
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
