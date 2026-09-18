// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const HTML_DOCTYPE_PATTERN = /<!doctype\s+html\s*>/iu;
const HTML_ROOT_END = '</html>';

/**
 * Extract an HTML document from a model response, tolerating a short preamble
 * or a Markdown fence while keeping only the document sent to the browser.
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

/** Validate the document envelope before the final source reaches srcDoc. */
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
