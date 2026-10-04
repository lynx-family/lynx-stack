// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Matches the hash placeholders that rspack's `compilation.getPath` resolves
 * on emitted assets. The optional `:N` suffix truncates the digest to `N`
 * characters.
 */
const HASH_PLACEHOLDER =
  /\[(?:contenthash|fullhash|chunkhash|hash)(?::(\d+))?\]/g

/**
 * Whether the bundle filename template still contains a hash placeholder.
 *
 * `resolveBundleFilename` only fills `[name]` and `[platform]`: the hash is
 * computed from the encoded template, which does not exist until
 * `LynxTemplatePlugin` has encoded it, so it stays verbatim in the filename
 * that the dev server prints (and encodes into the QR code).
 */
export function hasHashPlaceholder(template: string): boolean {
  HASH_PLACEHOLDER.lastIndex = 0
  return HASH_PLACEHOLDER.test(template)
}

/**
 * Removes the hash placeholders from a bundle filename template, e.g.
 * `main.lynx.[contenthash:8].bundle` becomes `main.lynx.bundle`.
 *
 * The dev server URL (and the QR code) is printed with the placeholders
 * removed: the hash changes on every recompile, so a stable URL that the
 * `createBundleResolveMiddleware` resolves to the latest emitted bundle is
 * more useful than one that goes stale after the first edit.
 *
 * A placeholder usually joins two segments (`…lynx.[contenthash:8].bundle`),
 * so it is removed together with the dot that follows it; one not followed by
 * a dot (e.g. at the end of the template) is removed on its own.
 */
export function stripHashPlaceholders(template: string): string {
  return template
    .replace(/\[(?:contenthash|fullhash|chunkhash|hash)(?::\d+)?\]\./g, '')
    .replace(/\[(?:contenthash|fullhash|chunkhash|hash)(?::\d+)?\]/g, '')
}

/**
 * Builds a RegExp matching the requested dev-server pathname for a filename
 * template that still contains hash placeholders. The placeholder is matched
 * verbatim (the brackets included), e.g. `main.lynx.[contenthash:8].bundle`
 * matches `/main.lynx.[contenthash:8].bundle` — the URL as printed and as
 * encoded into the QR code.
 */
export function templateToRequestRegExp(template: string): RegExp {
  return new RegExp(escapeRegExp(template))
}

/**
 * Builds a RegExp matching the emitted asset names for a filename template
 * that still contains hash placeholders, e.g.
 * `main.lynx.[contenthash:8].bundle` matches `main.lynx.6e10a1f5.bundle`.
 *
 * The digest is lowercase hex: `LynxTemplatePlugin` computes it with
 * xxhash64 (rspack's default `output.hashFunction`) and
 * `compilation.getPath` renders it with `hex` encoding.
 */
export function hashPlaceholderToRegExp(template: string): RegExp {
  const source: string[] = []
  let lastIndex = 0

  HASH_PLACEHOLDER.lastIndex = 0
  for (const match of template.matchAll(HASH_PLACEHOLDER)) {
    const index = match.index!
    source.push(escapeRegExp(template.slice(lastIndex, index)))
    source.push(match[1] ? `[0-9a-f]{${match[1]}}` : '[0-9a-f]+')
    lastIndex = index + match[0].length
  }
  source.push(escapeRegExp(template.slice(lastIndex)))

  return new RegExp(source.join(''))
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
