// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const MAX_REACTWEB_DOCUMENT_BYTES = 16 * 1024 * 1024;

/** Download compiled HTML at the parent origin before sandboxed execution. */
export async function loadReactWebDocument(
  value: string | null,
  signal: AbortSignal,
): Promise<string> {
  if (!value) throw new Error('Missing ReactWeb source URL');
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) || url.username || url.password
  ) {
    throw new Error('Invalid ReactWeb source URL');
  }
  const response = await window.fetch(url.href, {
    credentials: 'omit',
    redirect: 'error',
    cache: 'force-cache',
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error('Unable to load the ReactWeb preview');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let source = '';
  let complete = false;
  try {
    if (
      Number(response.headers.get('content-length'))
        > MAX_REACTWEB_DOCUMENT_BYTES
    ) {
      throw new Error('ReactWeb preview is too large');
    }
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_REACTWEB_DOCUMENT_BYTES) {
        throw new Error('ReactWeb preview is too large');
      }
      source += decoder.decode(chunk.value, { stream: true });
    }
    source += decoder.decode();
    signal.throwIfAborted();
    if (
      !/^<!doctype html>/iu.test(source.trim())
      || !/<\/html>\s*$/iu.test(source)
    ) {
      throw new Error('Invalid ReactWeb preview document');
    }
    complete = true;
    return source;
  } finally {
    if (!complete) {
      await reader.cancel().catch(() => {
        // Preserve the original fetch or validation failure after cancellation.
      });
    }
    reader.releaseLock();
  }
}
