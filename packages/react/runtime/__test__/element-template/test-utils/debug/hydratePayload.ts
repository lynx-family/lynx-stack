import type { SerializedEtNode } from '../../../../src/element-template/protocol/types.js';

export function extractSerializedHydrateInstances(data: unknown): SerializedEtNode[] {
  if (Array.isArray(data)) {
    return data as SerializedEtNode[];
  }

  if (data !== null && typeof data === 'object') {
    const payload = data as { instances?: unknown };
    if (Array.isArray(payload.instances)) {
      return payload.instances as SerializedEtNode[];
    }
  }

  return [];
}
