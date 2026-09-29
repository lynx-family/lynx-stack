// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createNativeElementTemplateApi,
  createPageElementTemplate,
} from '../src/native.js';

function installNativeApi() {
  const appendElement = vi.fn();
  const createElementTemplate = vi.fn(
    (
      _templateKey: string,
      _bundleUrl: string | null,
      _attributes: unknown,
      _children: unknown,
      id: number,
    ) => ({ id }),
  );
  const createPage = vi.fn(() => ({ id: 'page' }));
  const flushElementTree = vi.fn();
  const insertElementBefore = vi.fn();
  const insertNodeToElementTemplate = vi.fn();
  const removeElement = vi.fn();
  const removeNodeFromElementTemplate = vi.fn();
  const setAttributeOfElementTemplate = vi.fn();

  vi.stubGlobal('__AppendElement', appendElement);
  vi.stubGlobal('__CreateElementTemplate', createElementTemplate);
  vi.stubGlobal('__CreatePage', createPage);
  vi.stubGlobal('__FlushElementTree', flushElementTree);
  vi.stubGlobal('__InsertElementBefore', insertElementBefore);
  vi.stubGlobal(
    '__InsertNodeToElementTemplate',
    insertNodeToElementTemplate,
  );
  vi.stubGlobal('__RemoveElement', removeElement);
  vi.stubGlobal(
    '__RemoveNodeFromElementTemplate',
    removeNodeFromElementTemplate,
  );
  vi.stubGlobal(
    '__SetAttributeOfElementTemplate',
    setAttributeOfElementTemplate,
  );

  return {
    appendElement,
    createElementTemplate,
    createPage,
    flushElementTree,
    insertElementBefore,
    insertNodeToElementTemplate,
    removeElement,
    removeNodeFromElementTemplate,
    setAttributeOfElementTemplate,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SolidLynx native Element Template adapter', () => {
  test('uses legacy Element PAPI for page children', () => {
    const native = installNativeApi();
    const api = createNativeElementTemplateApi();
    const page = createPageElementTemplate();
    const first = api.createTemplate({
      handleId: -1,
      templateKey: 'view',
      bundleUrl: null,
      attributeSlots: null,
      childSlots: null,
    })!;
    const second = api.createTemplate({
      handleId: -2,
      templateKey: 'view',
      bundleUrl: null,
      attributeSlots: null,
      childSlots: null,
    })!;

    api.insertNode({
      parent: page,
      childSlotIndex: 0,
      child: first,
      before: null,
    });
    api.insertNode({
      parent: page,
      childSlotIndex: 0,
      child: second,
      before: first,
    });
    api.removeNode({
      parent: page,
      childSlotIndex: 0,
      child: first,
    });

    expect(native.createPage).toHaveBeenCalledWith('0', 0);
    expect(native.appendElement).toHaveBeenCalledWith(
      { id: 'page' },
      { id: -1 },
    );
    expect(native.insertElementBefore).toHaveBeenCalledWith(
      { id: 'page' },
      { id: -2 },
      { id: -1 },
    );
    expect(native.removeElement).toHaveBeenCalledWith(
      { id: 'page' },
      { id: -1 },
    );
    expect(native.insertNodeToElementTemplate).not.toHaveBeenCalled();
  });

  test('unwraps native refs for Element Template operations', () => {
    const native = installNativeApi();
    const api = createNativeElementTemplateApi();
    const child = api.createTemplate({
      handleId: -1,
      templateKey: 'text',
      bundleUrl: null,
      attributeSlots: ['child'],
      childSlots: null,
    })!;
    const parent = api.createTemplate({
      handleId: -2,
      templateKey: 'view',
      bundleUrl: null,
      attributeSlots: [{ class: 'parent' }],
      childSlots: [[child]],
    })!;

    api.insertNode({
      parent,
      childSlotIndex: 0,
      child,
      before: null,
    });
    api.setAttribute(parent, 0, { class: 'updated' });
    api.setAttribute(parent, 1, '-2:1:');
    api.setAttribute(parent, 1, null);
    api.removeNode({
      parent,
      childSlotIndex: 0,
      child,
    });
    api.flush?.();

    expect(native.createElementTemplate).toHaveBeenLastCalledWith(
      'view',
      null,
      [{ class: 'parent' }],
      [[{ id: -1 }]],
      -2,
    );
    expect(native.insertNodeToElementTemplate).toHaveBeenCalledWith(
      { id: -2 },
      0,
      { id: -1 },
      null,
    );
    expect(native.setAttributeOfElementTemplate).toHaveBeenCalledWith(
      { id: -2 },
      0,
      { class: 'updated' },
    );
    expect(native.setAttributeOfElementTemplate).toHaveBeenCalledWith(
      { id: -2 },
      1,
      '-2:1:',
    );
    expect(native.removeNodeFromElementTemplate).toHaveBeenCalledWith(
      { id: -2 },
      0,
      { id: -1 },
    );
    expect(native.flushElementTree).toHaveBeenCalledOnce();
  });
});
