// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * SWC transform runner for `<script main-thread>` blocks.
 *
 * Called by vue-main-thread-pre-loader with the raw content of a
 * `<script main-thread>` block and a target mode:
 *
 *   - 'BG'  → produce worklet context object declarations (injected into
 *              <script setup> so the template can bind main-thread handlers).
 *   - 'MT'  → produce registerWorkletInternal(...) calls (run on the Lepus
 *              Main Thread to register handler closures).
 *
 * TODO: replace with a real SWC plugin invocation once
 * packages/vue/transform has a compiled native/wasm SWC plugin.
 * This JS implementation handles the common cases (function declarations
 * and arrow/function-expression const exports) as a build-time stand-in.
 */
export function runSwcTransform(
  source: string,
  filename: string,
  target: 'BG' | 'MT',
  _options: Record<string, unknown>,
): Promise<string> {
  if (target === 'BG') {
    return Promise.resolve(transformToBg(source, filename));
  }
  return Promise.resolve(transformToMt(source, filename));
}

// ---------------------------------------------------------------------------
// Regex that matches the exported name from the two supported forms:
//   export function name(         → capture group 1
//   export async function name(   → capture group 1
//   export const name = (         → capture group 2  (arrow fn)
//   export const name = function  → capture group 2  (fn expression)
//   export const name = async (   → capture group 2
// ---------------------------------------------------------------------------
const EXPORT_NAME_RE =
  /^export\s+(?:async\s+)?function\s+(\w+)|^export\s+const\s+(\w+)\s*=/gm;

function extractExportedNames(source: string): string[] {
  const names: string[] = [];
  EXPORT_NAME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXPORT_NAME_RE.exec(source)) !== null) {
    const name = m[1] ?? m[2];
    if (name) names.push(name);
  }
  return names;
}

/**
 * BG transform: replace each exported handler with a worklet context object.
 *
 *   export function onTap(event) { ... }
 *   →
 *   export const onTap = { _wkltId: 'src/foo/Bar.vue:onTap', _c: {} };
 *
 * The function bodies are intentionally discarded — they run on the Main
 * Thread (registered via the MT bundle), not in the BG JS engine.
 */
function transformToBg(source: string, filename: string): string {
  const names = extractExportedNames(source);
  return names
    .map(
      (name) =>
        `export const ${name} = { _wkltId: ${
          JSON.stringify(`${filename}:${name}`)
        }, _c: {} };`,
    )
    .join('\n');
}

/**
 * MT transform: strip `export` and append registerWorkletInternal() calls.
 *
 *   export function onTap(event) { ... }
 *   →
 *   function onTap(event) { ... }
 *   registerWorkletInternal('main-thread', 'src/foo/Bar.vue:onTap', onTap);
 */
function transformToMt(source: string, filename: string): string {
  const names = extractExportedNames(source);
  const stripped = source.replace(/^export\s+/gm, '');
  const registrations = names
    .map(
      (name) =>
        `registerWorkletInternal("main-thread", ${
          JSON.stringify(`${filename}:${name}`)
        }, ${name});`,
    )
    .join('\n');
  return registrations ? `${stripped}\n${registrations}` : stripped;
}
