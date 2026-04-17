// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RuntimeOptions, SerializableValue } from '../../protocol/types.js';
import { __page } from '../page/page.js';
import { reserveElementTemplateId } from '../template/handle.js';
import { setElementTemplateNativeRef } from '../template/registry.js';

export const ELEMENT_TEMPLATE_LIST_OPTION = '__elementTemplateList';
export const ELEMENT_TEMPLATE_ATTRIBUTES_OPTION = '__elementTemplateAttributes';
const LIST_ITEM_PLATFORM_INFO_KEYS = /* @__PURE__ */ new Set<string>([
  'reuse-identifier',
  'full-span',
  'item-key',
  'sticky-top',
  'sticky-bottom',
  'estimated-height',
  'estimated-height-px',
  'estimated-main-axis-size-px',
  'recyclable',
]);
const LIST_ITEM_PLATFORM_INFO_VIRTUAL_KEYS = /* @__PURE__ */ new Set<string>([
  'reuse-identifier',
  'recyclable',
]);

type ElementTemplateListOptions = RuntimeOptions & {
  [ELEMENT_TEMPLATE_LIST_OPTION]?: boolean;
  [ELEMENT_TEMPLATE_ATTRIBUTES_OPTION]?: SerializableValue;
};

type ElementTemplateAttributeDescriptor =
  | {
    kind: 'attribute';
    binding: 'static';
    key?: string;
    value?: SerializableValue;
  }
  | {
    kind: 'attribute';
    binding: 'slot';
    key?: string;
    attrSlotIndex?: number;
  }
  | {
    kind: 'spread';
    binding: 'slot';
    attrSlotIndex?: number;
  };

type SerializableRecord = Record<string, SerializableValue | undefined>;
export interface ElementTemplateListCellRef {
  __elementTemplateListCell: true;
  nativeRef: ElementRef;
  templateId: string;
  attributeSlots: SerializableValue[] | null;
  platformInfo: Record<string, unknown> | null;
}

type ListInsertAction = Record<string, unknown> & {
  position: number;
  type: string;
};
interface ListOperations {
  insertAction: ListInsertAction[];
  removeAction: number[];
  updateAction: Record<string, unknown>[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isElementTemplateListCellRef(value: unknown): value is ElementTemplateListCellRef {
  return isRecord(value)
    && value['__elementTemplateListCell'] === true
    && 'nativeRef' in value
    && typeof value['templateId'] === 'string';
}

export function createElementTemplateListCellRef(
  nativeRef: ElementRef,
  templateId: string,
  attributeSlots: SerializableValue[] | null | undefined,
  platformInfo: Record<string, unknown> | null | undefined = null,
): ElementTemplateListCellRef {
  return {
    __elementTemplateListCell: true,
    nativeRef,
    templateId,
    attributeSlots: attributeSlots ?? null,
    platformInfo: platformInfo ?? null,
  };
}

export function splitListItemAttributeSlots(
  attributeSlots: SerializableValue[] | null | undefined,
): {
  templateAttributeSlots: SerializableValue[] | null;
  platformInfo: Record<string, unknown> | null;
} {
  if (!Array.isArray(attributeSlots)) {
    return {
      templateAttributeSlots: attributeSlots ?? null,
      platformInfo: null,
    };
  }

  const templateAttributeSlots: SerializableValue[] = [];
  const platformInfo: Record<string, unknown> = {};

  for (const slotValue of attributeSlots) {
    if (!isRecord(slotValue)) {
      templateAttributeSlots.push(slotValue);
      continue;
    }

    const templateSlotValue: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(slotValue)) {
      if (LIST_ITEM_PLATFORM_INFO_KEYS.has(key)) {
        platformInfo[key] = value;
      } else {
        templateSlotValue[key] = value;
      }
    }

    if (Object.keys(templateSlotValue).length > 0) {
      templateAttributeSlots.push(templateSlotValue as SerializableValue);
    }
  }

  return {
    templateAttributeSlots,
    platformInfo: Object.keys(platformInfo).length > 0 ? platformInfo : null,
  };
}

function normalizeListCells(
  elementSlots: Array<Array<ElementRef | ElementTemplateListCellRef>> | null | undefined,
): ElementTemplateListCellRef[] {
  const cells = elementSlots?.[0] ?? [];
  return cells.map((cell, index) => {
    if (!isElementTemplateListCellRef(cell)) {
      throw new Error(`ElementTemplate list expected a wrapped cell at index ${index}.`);
    }
    return cell;
  });
}

function toAttributeDescriptors(
  value: SerializableValue | undefined,
): ElementTemplateAttributeDescriptor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(slotValue => isRecord(slotValue)) as ElementTemplateAttributeDescriptor[];
}

function normalizeAttrKey(key: string): string {
  return key === 'className' ? 'class' : key;
}

function getSpreadSlotValue(
  attributeSlots: SerializableValue[] | null | undefined,
  attrSlotIndex: number | undefined,
): SerializableRecord | undefined {
  const direct = attributeSlots?.[attrSlotIndex ?? -1];
  if (isRecord(direct) && !Array.isArray(direct) && '__spread' in direct) {
    return direct as SerializableRecord;
  }

  const spreadSlot = attributeSlots?.find((slotValue) =>
    isRecord(slotValue) && !Array.isArray(slotValue) && '__spread' in slotValue
  );
  if (spreadSlot && isRecord(spreadSlot) && !Array.isArray(spreadSlot)) {
    return spreadSlot as SerializableRecord;
  }

  return undefined;
}

function readValueFromSpreadSlot(
  spreadValue: SerializableRecord | undefined,
  key: string,
): SerializableValue | undefined {
  if (!spreadValue) {
    return undefined;
  }

  if (key in spreadValue) {
    return spreadValue[key];
  }

  if (key === 'class' && 'className' in spreadValue) {
    return spreadValue['className'];
  }

  return undefined;
}

function stringifyAttributeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function applyAttribute(target: FiberElement, key: string, value: unknown): void {
  if (key === 'class' || key === 'className') {
    __SetClasses(target, value == null ? '' : stringifyAttributeValue(value));
    return;
  }

  if (key === 'style') {
    __SetInlineStyles(target, value ?? '');
    return;
  }

  if (key === 'id') {
    __SetID(target, value == null ? null : stringifyAttributeValue(value));
    return;
  }

  __SetAttribute(target, key, value ?? null);
}

function applyListAttributes(
  list: FiberElement,
  descriptors: ElementTemplateAttributeDescriptor[],
  attributeSlots: SerializableValue[] | null | undefined,
): void {
  let datasetTouched = false;
  const dataset: Record<string, unknown> = {};

  for (const descriptor of descriptors) {
    if (descriptor.kind === 'attribute') {
      const key = descriptor.key;
      if (!key) {
        continue;
      }

      const normalizedKey = normalizeAttrKey(key);
      let value: unknown;
      if (descriptor.binding === 'static') {
        value = descriptor.value;
      } else {
        const hasDirectSlot = Array.isArray(attributeSlots)
          && descriptor.attrSlotIndex !== undefined
          && descriptor.attrSlotIndex in attributeSlots;
        const direct = attributeSlots?.[descriptor.attrSlotIndex ?? -1];
        if (hasDirectSlot) {
          value = isRecord(direct) && '__spread' in direct
            ? readValueFromSpreadSlot(direct, key)
            : direct;
        } else {
          value = readValueFromSpreadSlot(
            getSpreadSlotValue(attributeSlots, descriptor.attrSlotIndex),
            key,
          );
        }
      }

      if (value === undefined && descriptor.binding === 'static') {
        continue;
      }

      if (normalizedKey.startsWith('data-')) {
        datasetTouched = true;
        const datasetKey = normalizedKey.slice(5);
        if (value === undefined || value === null) {
          delete dataset[datasetKey];
        } else {
          dataset[datasetKey] = value;
        }
      } else {
        applyAttribute(list, normalizedKey, value);
      }
      continue;
    }

    const spreadValue = getSpreadSlotValue(attributeSlots, descriptor.attrSlotIndex);
    if (!spreadValue) {
      continue;
    }

    for (const [spreadKey, spreadAttrValue] of Object.entries(spreadValue)) {
      if (spreadKey === '__spread') {
        continue;
      }

      const normalizedKey = normalizeAttrKey(spreadKey);
      if (normalizedKey.startsWith('data-')) {
        datasetTouched = true;
        dataset[normalizedKey.slice(5)] = spreadAttrValue;
      } else {
        applyAttribute(list, normalizedKey, spreadAttrValue);
      }
    }
  }

  if (datasetTouched) {
    __SetDataset(list, dataset);
  }
}

function extractListItemPlatformInfo(cell: ElementTemplateListCellRef): Record<string, unknown> | undefined {
  if (cell.platformInfo) {
    return cell.platformInfo;
  }

  const attributeSlots = cell.attributeSlots;
  if (!Array.isArray(attributeSlots)) {
    return undefined;
  }

  const platformInfo: Record<string, unknown> = {};
  for (const slotValue of attributeSlots) {
    if (!isRecord(slotValue)) {
      continue;
    }

    for (const key of LIST_ITEM_PLATFORM_INFO_KEYS) {
      if (key in slotValue) {
        platformInfo[key] = slotValue[key];
      }
    }
  }

  return Object.keys(platformInfo).length > 0 ? platformInfo : undefined;
}

function getListCellType(cell: ElementTemplateListCellRef): string {
  return cell.templateId;
}

function createInitialListUpdateInfo(cells: ElementTemplateListCellRef[]): ListOperations {
  return {
    insertAction: cells.map((cell, position) => ({
      position,
      type: getListCellType(cell),
      ...(extractListItemPlatformInfo(cell) ?? {}),
    })),
    removeAction: [],
    updateAction: [],
  };
}

function applyListItemPlatformInfo(cell: ElementTemplateListCellRef): void {
  const platformInfo = extractListItemPlatformInfo(cell);
  if (!platformInfo) {
    return;
  }

  for (const [key, value] of Object.entries(platformInfo)) {
    if (LIST_ITEM_PLATFORM_INFO_VIRTUAL_KEYS.has(key)) {
      continue;
    }
    __SetAttribute(cell.nativeRef as FiberElement, key, value);
  }
}

function getPageUniqueId(): number {
  try {
    return __GetElementUniqueID(__page);
  } catch {
    return 0;
  }
}

function createListCallbacks(
  list: FiberElement,
  listID: number,
  cells: ElementTemplateListCellRef[],
): readonly [ComponentAtIndexCallback, ComponentAtIndexesCallback] {
  const mounted = new Set<number>();

  const materializeCell = (
    cellIndex: number,
    operationID: number,
    enableBatchRender: boolean = false,
    asyncFlush: boolean = false,
  ): number => {
    const cell = cells[cellIndex];
    if (!cell) {
      throw new Error(`ElementTemplate list cell not found at index ${cellIndex}.`);
    }

    const sign = __GetElementUniqueID(cell.nativeRef);
    if (!mounted.has(cellIndex)) {
      applyListItemPlatformInfo(cell);
      __AppendElement(list, cell.nativeRef as FiberElement);
      mounted.add(cellIndex);
      if (enableBatchRender && asyncFlush) {
        __FlushElementTree(cell.nativeRef as FiberElement, {
          asyncFlush: true,
        });
      } else if (!enableBatchRender) {
        __FlushElementTree(cell.nativeRef as FiberElement, {
          triggerLayout: true,
          operationID,
          elementID: sign,
          listID,
        });
      }
    }

    return sign;
  };

  const componentAtIndex: ComponentAtIndexCallback = (
    _list,
    _listID,
    cellIndex,
    operationID,
    _enableReuseNotification,
  ) => {
    const sign = materializeCell(cellIndex, operationID);

    /* v8 ignore start */
    if (process.env['NODE_ENV'] === 'test') {
      return sign;
    }
    return sign;
    /* v8 ignore end */
  };

  const componentAtIndexes: ComponentAtIndexesCallback = (
    _list,
    _listID,
    cellIndexes,
    operationIDs,
    _enableReuseNotification,
    asyncFlush,
  ) => {
    const elementIDs = cellIndexes.map((cellIndex, index) =>
      materializeCell(cellIndex, operationIDs[index] ?? 0, true, asyncFlush)
    );

    __FlushElementTree(list, {
      triggerLayout: true,
      operationIDs,
      elementIDs,
      listID,
    });

    /* v8 ignore start */
    if (process.env['NODE_ENV'] === 'test') {
      return elementIDs as unknown as number;
    }
    return undefined;
    /* v8 ignore end */
  };

  return [componentAtIndex, componentAtIndexes] as const;
}

export function isElementTemplateList(
  options: RuntimeOptions | undefined,
): options is ElementTemplateListOptions {
  return Boolean(options?.[ELEMENT_TEMPLATE_LIST_OPTION]);
}

export function createElementTemplateListWithHandle(
  _templateKey: string,
  elementSlots: Array<Array<ElementRef | ElementTemplateListCellRef>> | null | undefined,
  attributeSlots: SerializableValue[] | null | undefined,
  options?: RuntimeOptions,
): ElementRef {
  const listOptions = options as ElementTemplateListOptions | undefined;
  const pageId = getPageUniqueId();
  const cells = normalizeListCells(elementSlots);
  const handleId = reserveElementTemplateId();
  const attributeDescriptors = toAttributeDescriptors(listOptions?.[ELEMENT_TEMPLATE_ATTRIBUTES_OPTION]);
  const list = __CreateList(
    pageId,
    () => undefined,
    () => undefined,
    {},
    () => undefined,
  );
  const listID = __GetElementUniqueID(list);
  applyListAttributes(list, attributeDescriptors, attributeSlots);
  const initialListUpdateInfo = createInitialListUpdateInfo(cells);
  __SetAttribute(list, 'update-list-info', initialListUpdateInfo);
  const [componentAtIndex, componentAtIndexes] = createListCallbacks(list, listID, cells);

  __UpdateListCallbacks(
    list,
    componentAtIndex,
    () => undefined,
    componentAtIndexes,
  );

  setElementTemplateNativeRef(handleId, list);

  return list;
}
