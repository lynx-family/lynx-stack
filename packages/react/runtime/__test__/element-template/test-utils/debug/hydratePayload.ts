import type { SerializedElementTemplate } from '../../../../src/element-template/protocol/types.js';

export function extractSerializedHydrateInstances(data: unknown): SerializedElementTemplate[] {
  if (Array.isArray(data)) {
    return data as SerializedElementTemplate[];
  }

  if (data !== null && typeof data === 'object') {
    const payload = data as { instances?: unknown };
    if (Array.isArray(payload.instances)) {
      return payload.instances as SerializedElementTemplate[];
    }
  }

  return [];
}
