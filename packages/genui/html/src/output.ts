// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const HTML_DOCTYPE_PATTERN = /<!doctype\s+html\s*>/iu;
const HTML_ROOT_END = '</html>';

/**
 * Extract an HTML document from a model response, tolerating a short preamble
 * or a Markdown fence while keeping only the document sent to the browser.
 *
 * @remarks
 * Partial documents are returned as soon as the doctype is present, allowing
 * streaming clients to display source before the document is complete.
 */
export function extractHtmlArtifact(value: string): string {
  const match = HTML_DOCTYPE_PATTERN.exec(value);
  if (!match || match.index === undefined) return '';

  const source = value.slice(match.index);
  const end = source.toLowerCase().lastIndexOf(HTML_ROOT_END);
  return source.slice(
    0,
    end === -1 ? undefined : end + HTML_ROOT_END.length,
  ).trimEnd();
}

/**
 * Check whether extracted source has the document envelope needed for preview.
 *
 * @remarks
 * This lightweight check requires a leading doctype, HTML root, head and body
 * opening tags, and a closing HTML tag. Use {@link normalizeHtmlArtifact} to
 * validate the final model response, including head and body closing tags.
 */
export function isCompleteHtmlArtifact(source: string): boolean {
  const doctype = HTML_DOCTYPE_PATTERN.exec(source);
  if (!doctype || doctype.index !== 0) return false;
  const documentSource = source.slice(doctype[0].length).trimStart();
  return /^<html(?:\s|>)/iu.test(documentSource)
    && /<head(?:\s|>)/iu.test(documentSource)
    && /<body(?:\s|>)/iu.test(documentSource)
    && source.trimEnd().toLowerCase().endsWith(HTML_ROOT_END);
}

/**
 * Extract an HTML document and validate its final document envelope.
 *
 * @remarks
 * Checks the doctype, HTML root, and head and body tag pairs. This is an
 * envelope check, not HTML sanitization; the host owns execution isolation.
 *
 * @throws Error if the response contains no HTML document or is incomplete.
 */
export function normalizeHtmlArtifact(value: string): string {
  const source = extractHtmlArtifact(value);
  if (!source) {
    throw new Error('HTML agent returned no <!doctype html> document');
  }
  if (!source.toLowerCase().endsWith(HTML_ROOT_END)) {
    throw new Error('HTML document is missing the closing </html> tag');
  }

  const doctype = HTML_DOCTYPE_PATTERN.exec(source);
  const documentSource = source.slice(doctype?.[0].length ?? 0).trimStart();
  if (!/^<html(?:\s|>)/iu.test(documentSource)) {
    throw new Error('HTML document must use <html> as its root');
  }
  if (!/<head(?:\s|>)/iu.test(documentSource)) {
    throw new Error('HTML document is missing a <head> element');
  }
  if (!/<\/head\s*>/iu.test(documentSource)) {
    throw new Error('HTML document is missing the closing </head> tag');
  }
  if (!/<body(?:\s|>)/iu.test(documentSource)) {
    throw new Error('HTML document is missing a <body> element');
  }
  if (!/<\/body\s*>/iu.test(documentSource)) {
    throw new Error('HTML document is missing the closing </body> tag');
  }

  return source;
}
