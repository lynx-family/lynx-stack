import { __pendingListUpdates, ListUpdateInfoRecording } from '../list.js';
import { SnapshotInstance } from '../snapshot.js';

const platformInfoVirtualAttributes: Set<string> = /* @__PURE__ */ new Set<string>(['reuse-identifier']);
const platformInfoAttributes: Set<string> = /* @__PURE__ */ new Set<string>([
  'reuse-identifier',
  'full-span',
  'item-key',
  'sticky-top',
  'sticky-bottom',
  'estimated-height',
  'estimated-height-px',
  'estimated-main-axis-size-px',
]);

function updateListItemPlatformInfo(
  ctx: SnapshotInstance,
  index: number,
  oldValue: any,
  elementIndex: number,
): void {
  const newValue = ctx.__listItemPlatformInfo = ctx.__values![index];

  // @ts-ignore
  const list = ctx.__parent;
  console.log(
    'updateListItemPlatformInfo',
    ctx.__snapshot_def.isListHolder,
    list?.__snapshot_def.isListHolder,
    ctx.__id,
    list?.__id,
    list?.__snapshot_def.isListHolder,
    newValue,
    oldValue,
  );
  if (list?.__snapshot_def.isListHolder) {
    (__pendingListUpdates.values[list.__id] ??= new ListUpdateInfoRecording(list)).onSetAttribute(
      ctx,
      newValue,
      oldValue,
    );
  }

  if (ctx.__elements && ctx.__snapshot_def.isListHolder) {
    __pendingListUpdates.values[ctx.__id]?.flush();
  }

  // In this updater, unlike `updateSpread`, the shape of the value is guaranteed to be an fixed object.
  // No adding / removing keys.
  if (ctx.__elements) {
    const e = ctx.__elements[elementIndex]!;
    const value = ctx.__values![index];
    for (const k in value) {
      if (platformInfoVirtualAttributes.has(k)) {
        continue;
      }
      __SetAttribute(e, k, value[k]);
    }
  }
}

export { updateListItemPlatformInfo, platformInfoAttributes };
