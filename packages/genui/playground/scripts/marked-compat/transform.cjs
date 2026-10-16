// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const MagicString = require('magic-string');
const rewritePattern = require('regexpu-core');

const MARKED_VERSION = '14.0.0';
const ORIGINAL = String.raw`const _punctuation = '\\p{P}\\p{S}';`;
const expanded = rewritePattern(String.raw`[\p{P}\p{S}]`, 'u', {
  unicodePropertyEscapes: 'transform',
});

// Marked inserts this value inside both positive and negative character
// classes. Preserve the u flag and supplementary code points, not just ASCII.
if (!expanded.startsWith('[') || !expanded.endsWith(']')) {
  throw new Error('Marked Unicode patch expected a single character class.');
}
const replacement = `const _punctuation = ${
  JSON.stringify(expanded.slice(1, -1))
};`;

exports.transformMarked = function transformMarked(source, version, filename) {
  if (version !== MARKED_VERSION) {
    throw new Error(
      `Marked Unicode patch requires ${MARKED_VERSION}; found ${version}. Review the patch before upgrading.`,
    );
  }
  const start = source.indexOf(ORIGINAL);
  if (start < 0 || source.indexOf(ORIGINAL, start + ORIGINAL.length) !== -1) {
    throw new Error(
      'Marked Unicode patch expected exactly one original _punctuation declaration. Review the upstream source.',
    );
  }
  const output = new MagicString(source);
  output.overwrite(start, start + ORIGINAL.length, replacement);
  return {
    code: output.toString(),
    map: output.generateMap({
      source: filename,
      includeContent: true,
      hires: true,
    }),
  };
};
