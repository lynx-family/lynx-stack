// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { publishA2UIPayload } from './publishPayload.js';
import type { SharedConversationDoc } from '../storage/sharedConversation.js';

/** Query param that carries the URL of a shared conversation document. */
export const IMPORT_CONVERSATION_PARAM = 'importConv';

/**
 * Upload a serialized conversation to the GenUI server (Supabase Storage) and
 * return the durable public URL of the stored document. Reuses the generic
 * A2UI payload upload path — the server stores the JSON body verbatim, so the
 * conversation document is persisted as-is.
 */
export async function publishConversation(
  doc: SharedConversationDoc,
): Promise<string> {
  const { messagesUrl } = await publishA2UIPayload(doc);
  return messagesUrl;
}

/**
 * Build a link that, when opened, imports the conversation into the recipient's
 * playground. Pins the hash route to `#/<protocol>/create` so the playground
 * lands on the chat tab where the import handler runs.
 */
export function buildConversationShareUrl(
  conversationUrl: string,
  baseUrl: string,
  protocolName: string,
): string {
  const url = new URL(baseUrl);
  url.search = '';
  url.searchParams.set(IMPORT_CONVERSATION_PARAM, conversationUrl);
  url.hash = `#/${protocolName}/create`;
  return url.toString();
}

export function readImportConversationParam(): string | null {
  return new URLSearchParams(window.location.search).get(
    IMPORT_CONVERSATION_PARAM,
  );
}

/** Remove the import param from the URL so a reload does not re-import. */
export function clearImportConversationParam(): void {
  if (!readImportConversationParam()) return;
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.hash,
  );
}
