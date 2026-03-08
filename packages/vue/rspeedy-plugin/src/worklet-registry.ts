// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Shared channel between worklet-loader and VueMainThreadPlugin.
 *
 * The loader calls addLepusRegistration() for each file that contains
 * 'main thread' directives. The plugin calls takeAllLepusRegistrations()
 * to append the collected LEPUS code to the main-thread bundle.
 *
 * IMPORTANT: We use globalThis to store the Map because rslib `bundle: true`
 * creates separate copies of this module in index.js and worklet-loader.js.
 * A module-level Map would result in two independent instances — the loader
 * writes to one and the plugin reads from another (always empty).
 * Using globalThis ensures both copies share the same underlying Map.
 */

const GLOBAL_KEY = '__vue_worklet_lepus_registrations__';

function getMap(): Map<string, string> {
  const g = globalThis as Record<string, unknown>;
  g[GLOBAL_KEY] ??= new Map<string, string>();
  return g[GLOBAL_KEY] as Map<string, string>;
}

export function addLepusRegistration(resourcePath: string, code: string): void {
  getMap().set(resourcePath, code);
}

export function getAllLepusRegistrations(): string {
  const map = getMap();
  if (map.size === 0) return '';
  return Array.from(map.values()).join('\n');
}

export function clearLepusRegistrations(): void {
  getMap().clear();
}
