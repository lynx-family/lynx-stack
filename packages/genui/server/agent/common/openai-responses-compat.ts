// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAnnotations(text: string): string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    // Let the SDK report malformed JSON with its original response body.
    return text;
  }
  if (!isRecord(value) || !Array.isArray(value.output)) return text;

  let changed = false;
  for (const item of value.output) {
    if (
      !isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)
    ) continue;
    for (const part of item.content) {
      if (
        isRecord(part) && part.type === 'output_text'
        && part.annotations === undefined
      ) {
        // Compatible Responses providers may omit the empty citation list.
        // Keep explicit values, including invalid ones, for SDK validation.
        part.annotations = [];
        changed = true;
      }
    }
  }
  return changed ? JSON.stringify(value) : text;
}

/** Normalize only successful JSON responses; leave SSE and errors untouched. */
export function createResponsesCompatFetch(
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const response = await fetchImpl(input, init);
    if (
      !response.ok || !response.body
      || response.headers.get('content-type')?.split(';')[0]?.trim()
          .toLowerCase() !== 'application/json'
    ) return response;

    const text = await response.text();
    const body = normalizeAnnotations(text);
    const headers = new Headers(response.headers);
    if (body !== text) {
      // fetch already decoded compressed bodies; the rewritten bytes have a
      // different length and must not retain the upstream encoding metadata.
      headers.delete('content-length');
      headers.delete('content-encoding');
    }
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
