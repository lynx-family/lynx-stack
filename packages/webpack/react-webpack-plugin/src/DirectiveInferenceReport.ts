// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { DirectiveInferenceRecord } from '@lynx-js/react/transform';

import { LAYERS } from './layer.js';

export const DIRECTIVE_INFERENCE_BUILD_INFO =
  'lynx:directive-inference-records';

interface ModuleWithDirectiveInference {
  layer?: string | null | undefined;
  buildInfo?: Record<string, unknown> | undefined;
  modules?: Iterable<ModuleWithDirectiveInference> | undefined;
}

interface LayeredRecord {
  layer: string;
  record?: DirectiveInferenceRecord;
}

export interface DirectiveInferenceReport {
  protocolVersion: 1;
  sites: DirectiveInferenceRecord[];
}

export function collectDirectiveInferenceRecords(
  modules: Iterable<ModuleWithDirectiveInference>,
): LayeredRecord[] {
  const records: LayeredRecord[] = [];
  const visited = new Set<ModuleWithDirectiveInference>();

  function collect(
    module: ModuleWithDirectiveInference,
    parentLayer: string | undefined,
  ): void {
    if (visited.has(module)) {
      return;
    }
    visited.add(module);

    const layer = module.layer ?? parentLayer ?? '';
    const values = module.buildInfo?.[DIRECTIVE_INFERENCE_BUILD_INFO];
    if (Array.isArray(values)) {
      records.push({ layer });
      for (const record of values as DirectiveInferenceRecord[]) {
        records.push({
          layer,
          record,
        });
      }
    }
    for (const nested of module.modules ?? []) {
      collect(nested, layer);
    }
  }

  for (const module of modules) {
    collect(module, undefined);
  }
  return records;
}

export function createDirectiveInferenceReport(
  layeredRecords: LayeredRecord[],
): DirectiveInferenceReport {
  const byLayer = new Map<string, Map<string, DirectiveInferenceRecord>>();
  for (const { layer, record } of layeredRecords) {
    const records = byLayer.get(layer)
      ?? new Map<string, DirectiveInferenceRecord>();
    byLayer.set(layer, records);
    if (record === undefined) {
      continue;
    }
    const key = recordKey(record);
    const existing = records.get(key);
    if (existing !== undefined && !recordsEqual(existing, record)) {
      throw new Error(
        `Directive-inference record collision at ${record.filename}:${record.start}-${record.end}.`,
      );
    }
    records.set(key, record);
  }

  const mainThread = byLayer.get(LAYERS.MAIN_THREAD)
    ?? new Map<string, DirectiveInferenceRecord>();
  const background = byLayer.get(LAYERS.BACKGROUND)
    ?? new Map<string, DirectiveInferenceRecord>();
  if (
    byLayer.has(LAYERS.MAIN_THREAD)
    && byLayer.has(LAYERS.BACKGROUND)
    && !mapKeysEqual(mainThread, background)
  ) {
    const mainOnly = [...mainThread.keys()].filter(key => !background.has(key));
    const backgroundOnly = [...background.keys()].filter(key =>
      !mainThread.has(key)
    );
    throw new Error(
      'Directive inference is not deterministic across main-thread and '
        + `background compilation. Main-thread-only: ${
          mainOnly.join(', ') || '(none)'
        }; `
        + `background-only: ${backgroundOnly.join(', ') || '(none)'}.`,
    );
  }

  const sites = new Map<string, DirectiveInferenceRecord>();
  for (const records of byLayer.values()) {
    for (const [key, record] of records) {
      sites.set(key, record);
    }
  }
  return {
    protocolVersion: 1,
    sites: [...sites.values()].sort(compareRecords),
  };
}

function recordKey(record: DirectiveInferenceRecord): string {
  return JSON.stringify([
    record.filename,
    record.start,
    record.end,
    record.package,
    record.packageVersion,
    record.manifest,
    record.source,
    record.export,
    record.path,
  ]);
}

function compareRecords(
  left: DirectiveInferenceRecord,
  right: DirectiveInferenceRecord,
): number {
  return left.filename.localeCompare(right.filename)
    || left.start - right.start
    || left.end - right.end
    || left.package.localeCompare(right.package)
    || left.source.localeCompare(right.source)
    || left.export.localeCompare(right.export)
    || left.path.localeCompare(right.path);
}

function recordsEqual(
  left: DirectiveInferenceRecord,
  right: DirectiveInferenceRecord,
): boolean {
  return recordKey(left) === recordKey(right);
}

function mapKeysEqual(
  left: Map<string, DirectiveInferenceRecord>,
  right: Map<string, DirectiveInferenceRecord>,
): boolean {
  return left.size === right.size
    && [...left.keys()].every(key => right.has(key));
}
