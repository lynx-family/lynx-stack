// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Writes the `import` or `export` a prose line starts with as a character
 * reference. MDX reads such a line as an ESM statement and fails to parse
 * the sentence that follows as JavaScript.
 */
export function escapeEsmLines(markdown: string): string {
  let fenced = false;
  return markdown
    .split('\n')
    .map(line => {
      if (/^\s*(?:```|~~~)/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      return line.replace(
        /^(?:import|export)(?=\s)/,
        word => `&#${word.charCodeAt(0)};${word.slice(1)}`,
      );
    })
    .join('\n');
}
