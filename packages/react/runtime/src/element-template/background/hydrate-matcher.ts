// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BackgroundElementTemplateInstance } from './shadow-instance.js';
import {
  MAIN_BUNDLE_URL_SENTINEL,
  elementTemplateIdentityKey,
  parseElementTemplateType,
} from '../protocol/template-type.js';
import type { SerializedCompiledNode, SerializedEtNode, SerializedTypedListNode } from '../protocol/types.js';

export interface HydrateChildListDiff {
  // Background child at a new slot index that has no matching serialized child.
  insertions: Record<number, BackgroundElementTemplateInstance>;
  insertionCount: number;
  // Serialized child indexes that no longer exist in the background slot.
  removals: number[];
  // Serialized child old index -> same-slot reorder target.
  moves: Record<number, { toIndex: number; instance: BackgroundElementTemplateInstance }>;
}

export type HydrateMatchedNodeCallback = (
  serialized: SerializedEtNode,
  instance: BackgroundElementTemplateInstance,
) => boolean;

const backgroundHydrateKeys = new Map<string, string>();

export function clearHydrateKeyCache(): void {
  backgroundHydrateKeys.clear();
}

export function isSerializedCompiledNode(
  serialized: SerializedEtNode,
): serialized is SerializedCompiledNode {
  return typeof (serialized as { templateKey?: unknown }).templateKey === 'string';
}

export function isSerializedTypedListNode(
  serialized: SerializedEtNode,
): serialized is SerializedTypedListNode {
  return !isSerializedCompiledNode(serialized) && serialized.tag === 'list';
}

export function getSerializedTypedListChildren(
  serialized: SerializedTypedListNode,
): SerializedEtNode[] {
  return (__DEV__ ? serialized.options?.listChildren : serialized.options!.listChildren)!;
}

export function arePairwiseHydrateKeysEqual(
  serializedChildren: SerializedEtNode[],
  backgroundChildren: BackgroundElementTemplateInstance[],
): boolean {
  const length = serializedChildren.length;
  if (length !== backgroundChildren.length) {
    return false;
  }
  for (let i = 0; i < length; i += 1) {
    if (
      getSerializedNodeHydrateKey(serializedChildren[i]!)
        !== getBackgroundNodeHydrateKey(backgroundChildren[i]!.type)
    ) {
      return false;
    }
  }
  return true;
}

export function diffHydrateSlotChildren(
  serializedChildren: SerializedEtNode[],
  backgroundChildren: BackgroundElementTemplateInstance[],
  hydrateMatchedNode: HydrateMatchedNodeCallback,
): HydrateChildListDiff | null {
  let lastPlacedIndex = 0;
  const result: HydrateChildListDiff = {
    insertions: {},
    insertionCount: 0,
    removals: [],
    moves: {},
  };
  const serializedByNodeKey: Record<string, [SerializedEtNode, number][]> = {};
  const serializedCursorByNodeKey: Record<string, number> = {};

  for (let i = 0; i < serializedChildren.length; i += 1) {
    const node = serializedChildren[i]!;
    const key = getSerializedNodeHydrateKey(node);
    (serializedByNodeKey[key] ??= []).push([node, i]);
  }

  for (let i = 0; i < backgroundChildren.length; i += 1) {
    const backgroundChild = backgroundChildren[i]!;
    // Normalize the background instance's full `${entry}:${key}` type tag to the
    // same native identity the serialized side uses (sentinel folded to the main
    // card), so main-card nodes match regardless of the `__Card__` prefix.
    const backgroundKey = getBackgroundNodeHydrateKey(backgroundChild.type);
    const serializedCandidates = serializedByNodeKey[backgroundKey];
    const candidateCursor = serializedCursorByNodeKey[backgroundKey] ?? 0;
    const matchedSerialized = serializedCandidates?.[candidateCursor];

    if (matchedSerialized) {
      serializedCursorByNodeKey[backgroundKey] = candidateCursor + 1;
      const oldIndex = matchedSerialized[1];
      if (!hydrateMatchedNode(matchedSerialized[0], backgroundChild)) {
        return null;
      }
      if (oldIndex < lastPlacedIndex) {
        result.moves[oldIndex] = { toIndex: i, instance: backgroundChild };
      } else {
        lastPlacedIndex = oldIndex;
      }
    } else {
      result.insertions[i] = backgroundChild;
      result.insertionCount += 1;
    }
  }

  for (const key in serializedByNodeKey) {
    const candidates = serializedByNodeKey[key]!;
    const candidateCursor = serializedCursorByNodeKey[key] ?? 0;
    for (let i = candidateCursor; i < candidates.length; i += 1) {
      result.removals.push(candidates[i]![1]);
    }
  }

  return result;
}

function getBackgroundNodeHydrateKey(type: string): string {
  const cached = backgroundHydrateKeys.get(type);
  if (cached !== undefined) {
    return cached;
  }
  const parsed = parseElementTemplateType(type);
  const key = elementTemplateIdentityKey(parsed.templateKey, parsed.bundleUrl);
  backgroundHydrateKeys.set(type, key);
  return key;
}

function getSerializedNodeHydrateKey(serialized: SerializedEtNode): string {
  if (!isSerializedCompiledNode(serialized)) {
    return serialized.tag;
  }
  return elementTemplateIdentityKey(
    serialized.templateKey,
    normalizeSerializedBundleUrl(serialized.bundleUrl),
  );
}

function normalizeSerializedBundleUrl(bundleUrl: string | undefined): string | null {
  return bundleUrl === undefined || bundleUrl === MAIN_BUNDLE_URL_SENTINEL ? null : bundleUrl;
}
