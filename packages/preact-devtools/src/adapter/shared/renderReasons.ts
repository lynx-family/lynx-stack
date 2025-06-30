import { ID } from '../../view/store/types';

export const enum RenderReason {
  MOUNT = 1,
  PARENT_UPDATE = 2,
  PROPS_CHANGED = 3,
  STATE_CHANGED = 4,
  HOOKS_CHANGED = 5,
  FORCE_UPDATE = 6,
}

export function renderReasonToStr(reason: RenderReason) {
  switch (reason) {
    case RenderReason.MOUNT:
      return 'mount';
    case RenderReason.PARENT_UPDATE:
      return 'parent update';
    case RenderReason.PROPS_CHANGED:
      return 'props changed';
    case RenderReason.STATE_CHANGED:
      return 'state changed';
    case RenderReason.HOOKS_CHANGED:
      return 'hooks changed';
    case RenderReason.FORCE_UPDATE:
      return 'force update';
  }
}

// TODO: Track value patch
export type RenderReasonItem = null | string[];

export interface RenderReasonData {
  type: RenderReason;
  items: RenderReasonItem;
}

export type RenderReasonMap = Map<ID, RenderReasonData | null>;

export function createReason(
  type: RenderReason,
  items: RenderReasonItem,
): RenderReasonData {
  return { type, items };
}

/**
 * Get all keys that have different values in two objects. Does a
 * shallow comparison.
 */
export function getChangedKeys(
  a: Record<string, any>,
  b: Record<string, any>,
): string[] {
  const changed: string[] = [];
  let key;
  for (key in a) {
    if (!(key in b) || a[key] !== b[key]) {
      changed.push(key);
    }
  }
  for (key in b) {
    if (!(key in a)) {
      changed.push(key);
    }
  }

  return changed;
}
