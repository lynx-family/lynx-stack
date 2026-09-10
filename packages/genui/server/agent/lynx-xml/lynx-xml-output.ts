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
 * Extract the raw Lynx XML document from a model response. This tolerates a
 * short prose preamble or Markdown fence while keeping the generated artifact
 * itself canonical for the runtime.
 */
export function extractLynxXmlArtifact(value: string): string {
  const start = value.indexOf(LYNX_XML_DOCTYPE);
  if (start === -1) return '';

  const end = value.lastIndexOf(LYNX_XML_ROOT_END);
  return value.slice(
    start,
    end >= start ? end + LYNX_XML_ROOT_END.length : undefined,
  ).trimEnd();
}

/**
 * Normalize and check the document-level contract before a generated artifact
 * is sent as the final SSE result. The Lynx runtime remains responsible for
 * parsing JavaScript and CSS inside the source sections.
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
