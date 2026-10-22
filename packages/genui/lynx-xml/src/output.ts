// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const LYNX_XML_DOCTYPE = '<!doctype lynx>';
const LYNX_XML_ROOT_END = '</lynx>';
const MAIN_THREAD_START = '<script thread="main">';
const MAIN_THREAD_END = '</script>';

function countOccurrences(source: string, value: string): number {
  let count = 0;
  let offset = 0;
  while (offset < source.length) {
    const next = source.indexOf(value, offset);
    if (next === -1) break;
    count++;
    offset = next + value.length;
  }
  return count;
}

/**
 * Extract complete or partial source for internal normalization and assembly.
 * @internal
 */
export function extractLynxXmlArtifact(value: string): string {
  const doctypeStart = value.indexOf(LYNX_XML_DOCTYPE);
  const rootStart = value.search(/<lynx\b/u);
  const start = doctypeStart >= 0 ? doctypeStart : rootStart;
  if (start < 0) return '';

  const end = value.lastIndexOf(LYNX_XML_ROOT_END);
  const artifact = value.slice(
    start,
    end >= start ? end + LYNX_XML_ROOT_END.length : undefined,
  ).trimEnd();
  return doctypeStart >= 0
    ? artifact
    : `${LYNX_XML_DOCTYPE}\n${artifact}`;
}

/**
 * Extract, normalize, and validate the document-level contract of a Lynx XML artifact.
 *
 * Requires a closing Lynx root with an engine version, exactly one closed
 * main-thread script, and no CDATA sections. Does not execute code or validate
 * JavaScript, CSS, Element PAPI semantics, or rendering. Compile intermediate
 * Template or ScriptReuse documents before validating the final artifact.
 *
 * @throws Error when the document-level contract is invalid.
 * @example
 * ```ts
 * const source = normalizeLynxXmlArtifact(modelResponse);
 * // Pass the normalized source to the renderer.
 * ```
 */
export function normalizeLynxXmlArtifact(value: string): string {
  const source = extractLynxXmlArtifact(value);
  if (!source) {
    throw new Error('Lynx XML agent returned no <!doctype lynx> artifact');
  }
  if (!source.endsWith(LYNX_XML_ROOT_END)) {
    throw new Error('Lynx XML artifact is missing the closing </lynx> tag');
  }

  const rootSource = source.slice(LYNX_XML_DOCTYPE.length).trimStart();
  if (!/^<lynx engine-version="[^"]+">/u.test(rootSource)) {
    throw new Error(
      'Lynx XML artifact must use <lynx engine-version="..."> as its root',
    );
  }
  if (countOccurrences(source, MAIN_THREAD_START) !== 1) {
    throw new Error(
      'Lynx XML artifact must contain exactly one main-thread script',
    );
  }
  const mainThreadStart = source.indexOf(MAIN_THREAD_START);
  if (
    !source.slice(mainThreadStart + MAIN_THREAD_START.length).includes(
      MAIN_THREAD_END,
    )
  ) {
    throw new Error('Lynx XML main-thread script is not closed');
  }
  if (source.includes('<![CDATA[')) {
    throw new Error('Lynx XML artifacts must not use CDATA sections');
  }

  return source;
}
