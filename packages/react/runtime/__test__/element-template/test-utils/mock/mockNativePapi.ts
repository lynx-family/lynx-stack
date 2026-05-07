// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, vi } from 'vitest';

// removed context import
import {
  formatNode,
  instantiateCompiledTemplate,
  isRecordForMock,
  isUnknownArrayForMock,
  insertNodeIntoTemplateInstance,
  removeNodeFromTemplateInstance,
  serializeTemplateInstance,
  setAttributeSlotOnTemplateInstance,
} from './mockNativePapi/templateTree.js';
import type { CompiledTemplateNode } from './mockNativePapi/templateTree.js';
import { clearTemplates, templateRepo } from '../debug/registry.js';

const isRecord = isRecordForMock;
const isUnknownArray = isUnknownArrayForMock;

export interface MockNativePapi {
  nativeLog: any[];
  mockCreateElementTemplate: any;
  mockSetClasses: any;
  mockSetInlineStyles: any;
  mockSetID: any;
  mockAddDataset: any;
  mockSetDataset: any;
  mockSetAttribute: any;
  mockSerializeElementTemplate: any;
  mockSetAttributeOfElementTemplate: any;
  mockInsertNodeToElementTemplate: any;
  mockRemoveNodeFromElementTemplate: any;
  mockReportError: any;
  mockFlushElementTree: any;
  mockCreatePage: any;
  mockAppendElement: any;
  cleanup: () => void;
}

export interface InstallMockNativePapiOptions {
  clearTemplatesOnCleanup?: boolean;
}

export let lastMock: MockNativePapi | undefined;
let isCleanupRegistered = false;

export function installMockNativePapi(
  options: InstallMockNativePapiOptions = {},
): MockNativePapi {
  const { clearTemplatesOnCleanup = false } = options;
  const nativeLog: any[] = [];
  let nextElementId = 1;
  // context setup moved to installThreadContexts

  const attachMockNativeId = (node: unknown): void => {
    if (!isRecord(node)) {
      return;
    }

    Object.defineProperty(node, '__mockNativeId', {
      value: nextElementId,
      writable: true,
      configurable: true,
    });
    nextElementId += 1;
  };

  const getElementUniqueID = (node: unknown): number => {
    if (!isRecord(node) || typeof node['__mockNativeId'] !== 'number') {
      throw new Error('MockNativePapi: element does not have a native id.');
    }
    return node['__mockNativeId'];
  };

  const mockCreateElementTemplate = vi.fn().mockImplementation((
    templateKey: string,
    bundleUrl: string | null | undefined,
    attributeSlots: unknown[] | null | undefined,
    elementSlots: unknown[][] | null | undefined,
    handleId: unknown,
  ) => {
    nativeLog.push(['__CreateElementTemplate', templateKey, bundleUrl, attributeSlots, elementSlots, handleId]);

    if (!templateRepo.has(templateKey)) {
      throw new Error(
        `ElementTemplate: Template '${templateKey}' not found in registry. Please register it using __REGISTER_ELEMENT_TEMPLATES__ before rendering.`,
      );
    }

    const template = templateRepo.get(templateKey) as unknown;
    const element = instantiateCompiledTemplate(template, attributeSlots, elementSlots);
    attachMockNativeId(element);
    element.templateId = templateKey;
    Object.defineProperty(element, '__compiledTemplate', {
      value: template,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(element, '__attributeSlots', {
      value: attributeSlots ?? null,
      writable: true,
      configurable: true,
    });
    if (typeof handleId === 'number') {
      Object.defineProperty(element, '__handleId', {
        value: handleId,
        writable: true,
        configurable: true,
      });
    }
    return element;
  });

  const mockSerializeElementTemplate = vi.fn().mockImplementation((templateInstance: unknown) => {
    return serializeTemplateInstance(templateInstance);
  });

  const mockReportError = vi.fn().mockImplementation((error: Error) => {
    const g = globalThis as unknown as { __LYNX_REPORT_ERROR_CALLS?: Error[] };
    g.__LYNX_REPORT_ERROR_CALLS ??= [];
    g.__LYNX_REPORT_ERROR_CALLS.push(error);
    nativeLog.push(['lynx.reportError', error]);
  });

  const mockCreatePage = vi.fn().mockImplementation((id: string, cssId: number) => {
    nativeLog.push(['__CreatePage', id, cssId]);
    const page = { type: 'page', id, cssId };
    attachMockNativeId(page);
    return page;
  });

  const mockAppendElement = vi.fn().mockImplementation((parent: unknown, child: unknown) => {
    const parentId = formatNode(parent);
    const childId = formatNode(child);
    nativeLog.push(['__AppendElement', parentId, childId]);
    if (isRecord(parent)) {
      const children = parent['children'];
      if (isUnknownArray(children)) {
        children.push(child);
      } else {
        parent['children'] = [child];
      }
    }
  });

  const mockSetAttribute = vi.fn().mockImplementation((element: unknown, name: string, value: unknown) => {
    nativeLog.push(['__SetAttribute', formatNode(element), name, value]);
    if (!isRecord(element)) {
      return;
    }

    const attributes = element['attributes'];
    if (isRecord(attributes)) {
      if (value === undefined || value === null) {
        delete attributes[name];
        return;
      }
      attributes[name] = value;
      return;
    }

    if (value !== undefined && value !== null) {
      element['attributes'] = { [name]: value };
    }
  });

  const mockSetClasses = vi.fn().mockImplementation((element: unknown, value: unknown) => {
    nativeLog.push(['__SetClasses', formatNode(element), value]);
    if (!isRecord(element)) {
      return;
    }

    const attributes = element['attributes'];
    if (isRecord(attributes)) {
      attributes['class'] = value;
      return;
    }

    element['attributes'] = { class: value };
  });

  const mockSetInlineStyles = vi.fn().mockImplementation((element: unknown, value: unknown) => {
    nativeLog.push(['__SetInlineStyles', formatNode(element), value]);
    if (!isRecord(element)) {
      return;
    }

    const attributes = element['attributes'];
    if (isRecord(attributes)) {
      attributes['style'] = value;
      return;
    }

    element['attributes'] = { style: value };
  });

  const mockSetID = vi.fn().mockImplementation((element: unknown, value: unknown) => {
    nativeLog.push(['__SetID', formatNode(element), value]);
    if (!isRecord(element)) {
      return;
    }

    const attributes = element['attributes'];
    if (isRecord(attributes)) {
      if (value === undefined || value === null) {
        delete attributes['id'];
        return;
      }
      attributes['id'] = value;
      return;
    }

    if (value !== undefined && value !== null) {
      element['attributes'] = { id: value };
    }
  });

  const mockAddDataset = vi.fn().mockImplementation((element: unknown, key: string, value: unknown) => {
    nativeLog.push(['__AddDataset', formatNode(element), key, value]);
    if (!isRecord(element)) {
      return;
    }

    const datasetKey = `data-${key}`;
    const attributes = element['attributes'];
    if (isRecord(attributes)) {
      attributes[datasetKey] = value;
      return;
    }

    element['attributes'] = { [datasetKey]: value };
  });

  const mockSetDataset = vi.fn().mockImplementation((element: unknown, value: unknown) => {
    nativeLog.push(['__SetDataset', formatNode(element), value]);
    if (!isRecord(element)) {
      return;
    }

    const nextDataset = isRecord(value) ? value : {};
    const attributes = isRecord(element['attributes']) ? element['attributes'] : {};

    Object.keys(attributes)
      .filter((key) => key.startsWith('data-'))
      .forEach((key) => {
        delete attributes[key];
      });

    Object.entries(nextDataset).forEach(([key, datasetValue]) => {
      attributes[`data-${key}`] = datasetValue;
    });

    element['attributes'] = attributes;
  });

  const mockSetAttributeOfElementTemplate = vi.fn().mockImplementation(
    (nativeRef: unknown, attrSlotIndex: number, value: unknown, options: unknown) => {
      nativeLog.push([
        '__SetAttributeOfElementTemplate',
        formatNode(nativeRef),
        attrSlotIndex,
        value,
        options,
      ]);
      if (isRecord(nativeRef)) {
        setAttributeSlotOnTemplateInstance(nativeRef as CompiledTemplateNode, attrSlotIndex, value);
      }
    },
  );

  const mockInsertNodeToElementTemplate = vi.fn().mockImplementation(
    (nativeRef: unknown, elementSlotIndex: number, node: unknown, referenceNode: unknown) => {
      nativeLog.push([
        '__InsertNodeToElementTemplate',
        formatNode(nativeRef),
        elementSlotIndex,
        formatNode(node),
        referenceNode == null ? null : formatNode(referenceNode),
      ]);
      if (isRecord(nativeRef)) {
        insertNodeIntoTemplateInstance(
          nativeRef as CompiledTemplateNode,
          elementSlotIndex,
          node,
          referenceNode,
        );
      }
    },
  );

  const mockRemoveNodeFromElementTemplate = vi.fn().mockImplementation(
    (nativeRef: unknown, elementSlotIndex: number, node: unknown) => {
      nativeLog.push([
        '__RemoveNodeFromElementTemplate',
        formatNode(nativeRef),
        elementSlotIndex,
        formatNode(node),
      ]);
      if (isRecord(nativeRef)) {
        removeNodeFromTemplateInstance(nativeRef as CompiledTemplateNode, elementSlotIndex, node);
      }
    },
  );

  const mockFlushElementTree = vi.fn().mockImplementation((element: unknown, options: unknown) => {
    nativeLog.push(['__FlushElementTree', formatNode(element), options]);
  });

  vi.stubGlobal('__CreateElementTemplate', mockCreateElementTemplate);
  vi.stubGlobal('__CreatePage', mockCreatePage);
  vi.stubGlobal('__AppendElement', mockAppendElement);
  vi.stubGlobal('__AddDataset', mockAddDataset);
  vi.stubGlobal('__SetDataset', mockSetDataset);
  vi.stubGlobal('__SetAttribute', mockSetAttribute);
  vi.stubGlobal('__SetClasses', mockSetClasses);
  vi.stubGlobal('__SetInlineStyles', mockSetInlineStyles);
  vi.stubGlobal('__SetID', mockSetID);
  vi.stubGlobal('__GetElementUniqueID', vi.fn().mockImplementation(getElementUniqueID));
  vi.stubGlobal('__SetAttributeOfElementTemplate', mockSetAttributeOfElementTemplate);
  vi.stubGlobal('__InsertNodeToElementTemplate', mockInsertNodeToElementTemplate);
  vi.stubGlobal('__RemoveNodeFromElementTemplate', mockRemoveNodeFromElementTemplate);
  vi.stubGlobal('__SerializeElementTemplate', mockSerializeElementTemplate);
  vi.stubGlobal('__FlushElementTree', mockFlushElementTree);
  const currentLynx = (globalThis as unknown as { lynx?: any }).lynx;
  const baseLynx = (currentLynx && typeof currentLynx === 'object') ? currentLynx : {};
  vi.stubGlobal('lynx', {
    ...baseLynx,
    reportError: mockReportError,
  });

  const result: MockNativePapi = {
    nativeLog: nativeLog,
    mockCreateElementTemplate: mockCreateElementTemplate,
    mockSetClasses: mockSetClasses,
    mockSetInlineStyles: mockSetInlineStyles,
    mockSetID: mockSetID,
    mockAddDataset: mockAddDataset,
    mockSetDataset: mockSetDataset,
    mockSetAttribute: mockSetAttribute,
    mockSerializeElementTemplate: mockSerializeElementTemplate,
    mockSetAttributeOfElementTemplate: mockSetAttributeOfElementTemplate,
    mockInsertNodeToElementTemplate: mockInsertNodeToElementTemplate,
    mockRemoveNodeFromElementTemplate: mockRemoveNodeFromElementTemplate,
    mockReportError: mockReportError,
    mockFlushElementTree: mockFlushElementTree,
    mockCreatePage: mockCreatePage,
    mockAppendElement: mockAppendElement,
    cleanup: (): void => {
      const errorCalls = mockReportError.mock.calls;
      if (clearTemplatesOnCleanup) {
        clearTemplates();
      }

      if (errorCalls.length > 0) {
        throw new Error(
          `lynx.reportError was called ${errorCalls.length} times:\n`
            + errorCalls
              .map((call: any[]) =>
                call
                  .map((arg) =>
                    arg instanceof Error
                      ? (arg.stack ?? arg.message)
                      : JSON.stringify(arg)
                  )
                  .join(' ')
              )
              .join('\n'),
        );
      }
    },
  };

  lastMock = result;
  if (!isCleanupRegistered) {
    isCleanupRegistered = true;
    afterEach(() => {
      lastMock?.cleanup();
    });
  }

  return result;
}
