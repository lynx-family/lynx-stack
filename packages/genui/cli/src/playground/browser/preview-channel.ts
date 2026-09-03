// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface PreviewCapability {
  conversationId: string;
  revision: string;
  hash: string;
  nonce: string;
}

export interface PreviewArtifactMessage extends PreviewCapability {
  type: 'genui-preview-artifact';
  source: unknown;
}

interface MessageLike {
  origin: string;
  source: unknown;
  data: unknown;
}

export function isPreviewReadyMessage(
  event: MessageLike,
  expectedOrigin: string,
  expectedSource: unknown,
  capability: PreviewCapability,
): boolean {
  return event.origin === expectedOrigin && event.source === expectedSource
    && matchesMessage(event.data, 'genui-preview-ready', capability);
}

export function isPreviewArtifactMessage(
  event: MessageLike,
  expectedOrigin: string,
  expectedSource: unknown,
  capability: PreviewCapability,
): event is MessageLike & { data: PreviewArtifactMessage } {
  return event.origin === expectedOrigin && event.source === expectedSource
    && matchesMessage(event.data, 'genui-preview-artifact', capability);
}

function matchesMessage(
  value: unknown,
  type: string,
  capability: PreviewCapability,
): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const message = value as Record<string, unknown>;
  return message['type'] === type && message['nonce'] === capability.nonce
    && message['conversationId'] === capability.conversationId
    && message['revision'] === capability.revision
    && message['hash'] === capability.hash;
}
