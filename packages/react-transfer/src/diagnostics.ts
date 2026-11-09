// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Experimental render counters for validating transfer root isolation.
 * Diagnostics are optional and are not part of the native event protocol.
 * @packageDocumentation
 */
import { diagnostics } from './context.js';

/**
 * Render instrumentation for the transfer chat fixture.
 * Call recordRender inside a registered component to count its actual executions.
 * @public
 */
export const transferDiagnostics: {
  /** Current thread and per-instance counters, available after the first registration. */
  readonly debug: {
    thread: string;
    records: Record<
      string,
      { renders: number; version: number; phase: string; seq: number }
    >;
  } | undefined;
  /** Records component execution; throws outside a registered transfer render. */
  recordRender(): void;
} = diagnostics;
