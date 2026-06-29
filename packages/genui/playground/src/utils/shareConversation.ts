// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { publishA2UIPayload } from './publishPayload.js';
import type { SharedConversationDoc } from '../storage/sharedConversation.js';

/** Query param that carries the URL of a shared conversation document. */
export const IMPORT_CONVERSATION_PARAM = 'importConv';
const SUPABASE_STORAGE_HOST_SUFFIX = '.supabase.co';
const SUPABASE_CONVERSATION_PATH_PATTERN =
  /^\/storage\/v1\/object\/public\/genui\/a2ui\/[^/]+\/messages\.json$/u;

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

function currentPageOrigin(): string {
  return typeof window === 'undefined'
    ? 'http://localhost'
    : window.location.origin;
}

function isTrustedSupabaseConversationUrl(endpoint: URL): boolean {
  return endpoint.protocol === 'https:'
    && endpoint.hostname.endsWith(SUPABASE_STORAGE_HOST_SUFFIX)
    && SUPABASE_CONVERSATION_PATH_PATTERN.test(endpoint.pathname);
}

/**
 * Resolve and validate a shared-conversation document URL before fetching it.
 * Conversation shares are published either on the current playground origin
 * (local/dev payload store) or as public Supabase Storage objects created by
 * the GenUI payload publisher.
 */
export function resolveTrustedConversationImportUrl(
  raw: string,
  pageOrigin = currentPageOrigin(),
): string | null {
  try {
    const endpoint = new URL(raw, pageOrigin);
    const origin = new URL(pageOrigin);
    if (
      endpoint.origin === origin.origin
      && (endpoint.protocol === 'http:' || endpoint.protocol === 'https:')
    ) {
      return endpoint.toString();
    }
    if (isTrustedSupabaseConversationUrl(endpoint)) {
      return endpoint.toString();
    }
  } catch {
    return null;
  }
  return null;
}

/** Remove the import param from the URL so a reload does not re-import. */
export function clearImportConversationParam(): void {
  if (!readImportConversationParam()) return;
  const url = new URL(window.location.href);
  url.searchParams.delete(IMPORT_CONVERSATION_PARAM);
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
}
