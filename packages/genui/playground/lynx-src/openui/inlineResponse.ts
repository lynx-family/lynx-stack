// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** A Markdown or OpenUI code segment in its original response order. */
export interface OpenUiResponsePart {
  /** Whether this segment contains chat Markdown or fenced OpenUI source. */
  kind: 'text' | 'code';
  /** Segment content without an OpenUI fence's opening and closing markers. */
  content: string;
  /** Whether an OpenUI fence is closed; omitted for ordinary Markdown. */
  complete?: boolean;
}

/**
 * Split inline replies into Markdown and OpenUI source segments in response order.
 * Recognizes labelled `openui` / `openui-lang` fences, including unfinished blocks.
 * The core OpenUI renderer remains responsible for parsing the extracted source.
 * While streaming, defer unfinished fence lines so their markers cannot enter
 * Markdown or OpenUI content before the delimiter is confirmed.
 */
export function splitOpenUiResponse(
  response: string,
  isStreaming = false,
): OpenUiResponsePart[] {
  const parts: OpenUiResponsePart[] = [];
  let offset = 0;
  let textStart = 0;
  let fence: {
    marker: string;
    length: number;
    openui: boolean;
    contentStart: number;
  } | null = null;

  for (const line of response.matchAll(/[^\n]*(?:\n|$)/g)) {
    if (!line[0]) continue;
    const value = line[0].replace(/\r?\n$/, '');
    const end = offset + line[0].length;
    const unfinishedLine = isStreaming && !line[0].endsWith('\n');
    if (fence) {
      const close = /^ {0,3}(`+|~+)[ \t]*$/.exec(value);
      if (
        fence.openui && unfinishedLine
        && close?.[1]?.[0] === fence.marker
      ) {
        parts.push({
          kind: 'code',
          content: response.slice(fence.contentStart, offset),
          complete: false,
        });
        return parts;
      }
      if (
        close?.[1]?.[0] === fence.marker
        && close[1].length >= fence.length
      ) {
        if (fence.openui) {
          parts.push({
            kind: 'code',
            content: response.slice(fence.contentStart, offset),
            complete: true,
          });
          textStart = end;
        }
        fence = null;
      }
    } else {
      if (
        unfinishedLine
        && /^ {0,3}(?:`{3,}[^`]*|~{3}.*|`{1,2}[ \t]*|~{1,2}[ \t]*)$/.test(
          value,
        )
      ) {
        parts.push({
          kind: 'text',
          content: response.slice(textStart, offset),
        });
        return parts;
      }
      const open = /^ {0,3}(`{3,}|~{3,})/.exec(value);
      const marker = open?.[1];
      const info = open ? value.slice(open[0].length).trim() : '';
      if (marker && !(marker.startsWith('`') && info.includes('`'))) {
        const language = info.split(/\s/, 1)[0];
        const openui = language === 'openui' || language === 'openui-lang';
        fence = {
          marker: marker[0]!,
          length: marker.length,
          openui,
          contentStart: end,
        };
        if (openui) {
          parts.push({
            kind: 'text',
            content: response.slice(textStart, offset),
          });
        }
      }
    }
    offset = end;
  }
  if (fence?.openui) {
    parts.push({
      kind: 'code',
      content: response.slice(fence.contentStart),
      complete: false,
    });
  } else {
    parts.push({ kind: 'text', content: response.slice(textStart) });
  }
  return parts;
}
