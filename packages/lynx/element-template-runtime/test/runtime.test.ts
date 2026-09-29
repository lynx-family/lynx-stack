// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test, vi } from 'vitest';

import {
  ELEMENT_TEMPLATE_COMMIT_EVENT,
  ELEMENT_TEMPLATE_EVENT_ATTRIBUTE_NAMES,
  ELEMENT_TEMPLATE_SPREAD_ATTRIBUTE_SLOT_INDEX,
  ElementTemplateCommandReceiver,
  ElementTemplateRuntime,
  createRemoteElementTemplateRuntime,
  getElementTemplateEventAttributeSlotIndex,
  isLynxEventAttributeName,
} from '../src/index.js';
import type {
  BackgroundElementTemplateChannel,
  CreateElementTemplateRequest,
  ElementTemplateBridgeCommit,
  MainElementTemplateChannel,
  NativeElementTemplateApi,
} from '../src/index.js';

function createNativeApi() {
  const createTemplate = vi.fn(
    (request: CreateElementTemplateRequest<string>): string =>
      `${request.templateKey}:${request.handleId}`,
  );
  const flush = vi.fn();
  const insertNode = vi.fn();
  const removeNode = vi.fn();
  const setAttribute = vi.fn();
  const api: NativeElementTemplateApi<string> = {
    createTemplate,
    flush,
    insertNode,
    removeNode,
    setAttribute,
  };
  return { api, createTemplate, flush, insertNode, removeNode, setAttribute };
}

function removeNoopListener(): void {
  // No listener is registered by this test channel.
}

function ignoreDispose(): () => void {
  return removeNoopListener;
}

describe('Element Template attribute slots', () => {
  test('assigns stable slots to common Lynx events', () => {
    expect(ELEMENT_TEMPLATE_SPREAD_ATTRIBUTE_SLOT_INDEX).toBe(0);
    expect(new Set(ELEMENT_TEMPLATE_EVENT_ATTRIBUTE_NAMES).size).toBe(
      ELEMENT_TEMPLATE_EVENT_ATTRIBUTE_NAMES.length,
    );
    expect(getElementTemplateEventAttributeSlotIndex('bindtap')).toBe(1);
    expect(getElementTemplateEventAttributeSlotIndex('bindscroll')).toBe(
      ELEMENT_TEMPLATE_EVENT_ATTRIBUTE_NAMES.indexOf('bindscroll') + 1,
    );
    expect(
      getElementTemplateEventAttributeSlotIndex('bindcustom'),
    ).toBeUndefined();
  });

  test('recognizes Lynx event attribute syntax', () => {
    expect(isLynxEventAttributeName('bindtap')).toBe(true);
    expect(isLynxEventAttributeName('capture-catchtouchstart')).toBe(true);
    expect(isLynxEventAttributeName('global-bindcustom')).toBe(true);
    expect(isLynxEventAttributeName('class')).toBe(false);
    expect(isLynxEventAttributeName('bind')).toBe(false);
  });
});

describe('ElementTemplateRuntime', () => {
  test('creates handle-dependent attribute slots before native creation', () => {
    const { api, createTemplate } = createNativeApi();
    const runtime = new ElementTemplateRuntime(api);

    const handle = runtime.createTemplate({
      templateKey: 'view',
      attributeSlotsFactory: handleId => [`${handleId}:1:`],
    });

    expect(handle.id).toBe(-1);
    expect(createTemplate).toHaveBeenCalledWith({
      handleId: -1,
      templateKey: 'view',
      bundleUrl: null,
      attributeSlots: ['-1:1:'],
      childSlots: null,
    });
    expect(() => {
      runtime.createTemplate({
        templateKey: 'view',
        attributeSlots: [],
        attributeSlotsFactory: () => [],
      });
    }).toThrow('cannot define both');
  });

  test('tracks insertion order, moves, and subtree release', () => {
    const { api, insertNode } = createNativeApi();
    const runtime = new ElementTemplateRuntime(api);
    const root = runtime.registerRoot('page');
    const parent = runtime.createTemplate({ templateKey: 'view' });
    const first = runtime.createTemplate({ templateKey: 'text' });
    const second = runtime.createTemplate({ templateKey: 'image' });

    runtime.insertNode(root, 0, parent);
    runtime.insertNode(parent, 0, first);
    runtime.insertNode(parent, 0, second, first);

    expect(insertNode).toHaveBeenNthCalledWith(3, {
      parent: parent.nativeHandle,
      childSlotIndex: 0,
      child: second.nativeHandle,
      before: first.nativeHandle,
    });

    expect(runtime.removeNode(root, 0, parent)).toEqual([
      second.id,
      first.id,
      parent.id,
    ]);
    expect(runtime.getHandle(parent.id)).toBeUndefined();
    expect(runtime.getHandle(first.id)).toBeUndefined();
    expect(runtime.getHandle(second.id)).toBeUndefined();
  });

  test('rejects cycles and references outside the destination slot', () => {
    const runtime = new ElementTemplateRuntime(createNativeApi().api);
    const root = runtime.registerRoot('page');
    const parent = runtime.createTemplate({ templateKey: 'view' });
    const child = runtime.createTemplate({ templateKey: 'text' });
    const detached = runtime.createTemplate({ templateKey: 'image' });

    runtime.insertNode(root, 0, parent);
    runtime.insertNode(parent, 0, child);

    expect(() => {
      runtime.insertNode(child, 0, parent);
    }).toThrow('cannot be inserted into its own subtree');
    expect(() => {
      runtime.insertNode(parent, 0, detached, root);
    }).toThrow('is not in child slot 0');
  });
});

describe('Element Template command bridge', () => {
  test('batches background commands and applies them on the main thread', () => {
    const commitListeners = new Set<
      (commit: ElementTemplateBridgeCommit) => void
    >();
    const disposeListeners = new Set<() => void>();
    const dispatched: ElementTemplateBridgeCommit[] = [];
    const backgroundChannel: BackgroundElementTemplateChannel = {
      dispatchToRemote(type, commit) {
        expect(type).toBe(ELEMENT_TEMPLATE_COMMIT_EVENT);
        dispatched.push(commit);
        for (const listener of commitListeners) {
          listener(commit);
        }
      },
      onDispose(listener) {
        disposeListeners.add(listener);
        return () => disposeListeners.delete(listener);
      },
    };
    const mainChannel: MainElementTemplateChannel = {
      onRemote(type, listener) {
        expect(type).toBe(ELEMENT_TEMPLATE_COMMIT_EVENT);
        commitListeners.add(listener);
        return () => commitListeners.delete(listener);
      },
      onDispose(listener) {
        disposeListeners.add(listener);
        return () => disposeListeners.delete(listener);
      },
    };
    const { api, flush, setAttribute } = createNativeApi();
    const receiver = new ElementTemplateCommandReceiver(
      mainChannel,
      api,
      'page',
    );
    const remote = createRemoteElementTemplateRuntime(backgroundChannel);

    const { parent, child } = remote.api.batch(() => {
      const parent = remote.runtime.createTemplate({
        templateKey: 'view',
        attributeSlots: [{ class: 'parent' }],
      });
      const child = remote.runtime.createTemplate({
        templateKey: 'text',
        attributeSlots: ['hello'],
      });
      remote.runtime.insertNode(parent, 0, child);
      remote.runtime.insertNode(remote.root, 0, parent);
      return { parent, child };
    });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]?.commands).toHaveLength(4);
    expect(receiver.getNativeHandle(parent.id)).toBe(`view:${parent.id}`);
    expect(receiver.getNativeHandle(child.id)).toBe(`text:${child.id}`);
    expect(flush).toHaveBeenCalledOnce();

    remote.runtime.setAttribute(parent, 0, { class: 'updated' });
    expect(setAttribute).toHaveBeenLastCalledWith(
      `view:${parent.id}`,
      0,
      { class: 'updated' },
    );
    expect(flush).toHaveBeenCalledTimes(2);

    remote.runtime.removeNode(remote.root, 0, parent);
    expect(receiver.getNativeHandle(parent.id)).toBeUndefined();
    expect(receiver.getNativeHandle(child.id)).toBeUndefined();

    for (const listener of [...disposeListeners]) {
      listener();
    }
    expect(() => remote.api.flush()).toThrow('disposed');
    expect(() => receiver.apply([])).toThrow('disposed');
  });

  test('coalesces initial attribute updates into template creation', () => {
    const commits: ElementTemplateBridgeCommit[] = [];
    const channel: BackgroundElementTemplateChannel = {
      dispatchToRemote(_type, commit) {
        commits.push(commit);
      },
      onDispose: ignoreDispose,
    };
    const remote = createRemoteElementTemplateRuntime(channel);

    const template = remote.api.batch(() => {
      const template = remote.runtime.createTemplate({
        templateKey: 'view',
      });
      remote.runtime.setAttribute(template, 2, 'count');
      remote.runtime.setAttribute(template, 0, 'ready');
      return template;
    });

    expect(commits).toEqual([{
      commands: [{
        type: 'createTemplate',
        request: {
          attributeSlots: ['ready', null, 'count'],
          bundleUrl: null,
          childSlots: null,
          handleId: template.id,
          templateKey: 'view',
        },
      }],
    }]);

    remote.runtime.setAttribute(template, 2, 'updated');
    expect(commits[1]).toEqual({
      commands: [{
        type: 'setAttribute',
        target: template.id,
        attributeSlotIndex: 2,
        value: 'updated',
      }],
    });
  });

  test('rolls back commands added by a failed batch', () => {
    const commits: ElementTemplateBridgeCommit[] = [];
    const channel: BackgroundElementTemplateChannel = {
      dispatchToRemote(_type, commit) {
        commits.push(commit);
      },
      onDispose: ignoreDispose,
    };
    const remote = createRemoteElementTemplateRuntime(channel);

    expect(() => {
      remote.api.batch(() => {
        remote.runtime.createTemplate({ templateKey: 'view' });
        throw new Error('render failed');
      });
    }).toThrow('render failed');
    remote.api.flush();

    expect(commits).toEqual([]);
  });
});
