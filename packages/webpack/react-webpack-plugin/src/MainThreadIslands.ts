// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The plugin half of a main-thread island — the opt-in direction of the
 * first-screen dial, on the assembled main-thread bundle of
 * `enableMTSRendering: false`.
 *
 * The assembled bundle's rule is "no business module enters the main-thread
 * layer; every definition the main thread needs travels as data". An island
 * is the one deliberate exception: its module *is* compiled into the
 * main-thread layer, with the LEPUS target, so the main thread can run its
 * render body on the first frame. Everything it imports comes with it — which
 * is why an island is authored deliberately, and why `'background only'` is
 * the tool for keeping the deferred parts out.
 */

export const MTS_ISLANDS_BUILD_INFO = 'lynx:mts-islands';

/** A component marked with the `'main thread component'` directive. */
export interface MTSIslandComponent {
  /** The declared (local) name. */
  name: string;
  /** The name it is exported under, when it is exported. */
  exported?: string | undefined;
}

/** What one module contributed, as reported by the transform. */
export interface MTSIslands {
  components: MTSIslandComponent[];
}

/**
 * The registry the island wrappers write their module namespaces into, so a
 * marked component is reachable even when nothing in the main-thread layer
 * imports it by name.
 */
const ISLAND_REGISTRY_SYMBOL = '__REACT_LYNX_MTS_ISLANDS__';

/**
 * The virtual entry module compiled into the main-thread layer for one module
 * that declares islands.
 *
 * A bare side-effect import would be enough to *build* the module, but not to
 * keep its exports: nothing else in the main-thread layer imports it, so
 * export analysis would drop the component bodies and leave only the
 * module-scope snapshot registrations behind. Importing the whole namespace
 * and storing it forces the bundler to provide every export as a live value.
 *
 * The wrapper has no location of its own, so the resource is embedded as an
 * already-resolved absolute path (resolved against the *reporting* module's
 * context by the plugin) — and it is a `data:` URI, which no loader matches,
 * so it ships to the main thread verbatim.
 */
export function islandModuleWrapper(resource: string): string {
  const source = [
    `import * as ns from ${JSON.stringify(resource)};`,
    `var registry = Symbol.for(${JSON.stringify(ISLAND_REGISTRY_SYMBOL)});`,
    `(globalThis[registry] = globalThis[registry] || new Map()).set(${
      JSON.stringify(resource)
    }, ns);`,
  ].join('\n');
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
