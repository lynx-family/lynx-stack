// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Fragment, h } from 'preact';
import { Suspense } from 'preact/compat';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createElementTemplateListState,
  destroyAllElementTemplateListStates,
  flushInitialElementTemplateListUpdates,
} from '../../../../src/element-template/runtime/list/list.js';
import { __ElementTemplatePage } from '../../../../src/element-template/runtime/page/authored-page.js';
import { createElementTemplatePage, setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import { renderToElementTemplate } from '../../../../src/element-template/runtime/render/render-direct.js';
import { renderMainThread } from '../../../../src/element-template/runtime/render/render-main-thread.js';
import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  adaptMTRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import {
  clearMainThreadDynamicAttrState,
  getMainThreadDynamicAttrState,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { registerBuiltinRawTextTemplate, registerTemplates } from '../../test-utils/debug/registry.js';

function Pending(): never {
  throw Promise.resolve();
}

function leaf(id: string, ref?: { _wvid: number }) {
  return h('__Card__:_et_suspense_leaf', { attributeSlots: [id, ref] });
}

beforeEach(() => {
  globalThis.__MAIN_THREAD__ = true;
  globalThis.__BACKGROUND__ = false;
  resetTemplateId();
  elementTemplateRegistry.clear();
  clearEtAttrPlanMap();
  clearMainThreadDynamicAttrState();
  destroyAllElementTemplateListStates();
  registerBuiltinRawTextTemplate();
  registerTemplates([
    {
      templateId: '_et_suspense_root',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        children: [{ kind: 'childSlot', type: 'slot', elementSlotIndex: 0 }],
      },
    },
    {
      templateId: '_et_suspense_leaf',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        attributesArray: [{ kind: 'slot', key: 'id', attrSlotIndex: 0 }],
      },
    },
  ]);
  setupPage(createElementTemplatePage());
});

afterEach(() => {
  vi.restoreAllMocks();
  clearEtAttrPlanMap();
  clearMainThreadDynamicAttrState();
  destroyAllElementTemplateListStates();
});

describe('direct renderer Suspense', () => {
  it('replaces already created content with every fallback root', () => {
    const result = renderToElementTemplate(h(
      Suspense,
      {
        fallback: h(Fragment, null, 'loading one', 'loading two'),
      },
      leaf('discarded'),
      h(Pending, null),
    ));

    expect(result.rootRefs.map(ref => __SerializeElementTemplate(ref).attributeSlots)).toEqual([
      ['loading one'],
      ['loading two'],
    ]);
    expect(result.rootSubtreeHandles).toEqual([[], []]);
  });

  it('keeps surrounding resolved content and uses the nearest boundary', () => {
    const result = renderToElementTemplate(
      h(
        Suspense,
        { fallback: 'outer loading' },
        'before',
        h(Suspense, { fallback: 'inner loading' }, h(Pending, null)),
        'after',
      ),
    );

    expect(result.rootRefs.map(ref => __SerializeElementTemplate(ref).attributeSlots)).toEqual([
      ['before'],
      ['inner loading'],
      ['after'],
    ]);
  });

  it.each([false, true])('attaches only surviving MTRefs with an enclosing host: %s', (enclosed) => {
    const abandoned = { _wvid: 101 };
    const surviving = { _wvid: 102 };
    __etAttrPlanMap['__Card__:_et_suspense_leaf'] = [1, adaptMTRefAttrSlot, 2, adaptMTEventAttrSlot];
    const create = vi.spyOn(globalThis, '__CreateElementTemplate');
    const attached: unknown[] = [];
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: { updateWorkletRef: (ref: unknown) => attached.push(ref) },
    } as typeof globalThis.lynxWorkletImpl;
    const boundary = h(
      Suspense,
      { fallback: leaf('fallback', surviving) },
      h('__Card__:_et_suspense_leaf', { attributeSlots: ['abandoned', abandoned, { _wkltId: 'abandoned-event' }] }),
      h(Pending, null),
    );
    const root = enclosed ? h('_et_suspense_root', { $0: boundary }) : boundary;
    setRoot({ __jsx: root });

    try {
      renderMainThread();
      expect(attached).toEqual([surviving]);
      const abandonedUid = create.mock.calls[0]![4];
      const fallbackUid = create.mock.calls[1]![4];
      expect(elementTemplateRegistry.has(abandonedUid)).toBe(false);
      expect(getMainThreadDynamicAttrState(abandonedUid, 1)).toBeUndefined();
      expect(getMainThreadDynamicAttrState(abandonedUid, 2)).toBeUndefined();
      expect(elementTemplateRegistry.get(fallbackUid)).toBe(create.mock.results[1]!.value);
      expect(getMainThreadDynamicAttrState(fallbackUid, 1)).toMatchObject({ kind: 'mt-ref', value: surviving });
      expect(fallbackUid).toBeLessThan(abandonedUid);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('discards abandoned list item UIDs before creating the surviving list', () => {
    const item = (key: string) =>
      h('__Card__:_et_suspense_leaf', {
        attributeSlots: [key],
        __listItemPlatformInfo: { 'item-key': key },
      });
    const createItem = vi.spyOn(globalThis, '__CreateElementTemplate');
    const createList = vi.spyOn(globalThis, '__CreateTypedElementTemplate');
    renderToElementTemplate(h('list', {
      $0: h(Suspense, { fallback: item('fallback') }, item('abandoned'), h(Pending, null)),
    }));

    const abandonedUid = __SerializeElementTemplate(createItem.mock.results[0]!.value).uid;
    expect(() => createElementTemplateListState([abandonedUid])).toThrow('non-list-item root');
    expect(createList).toHaveBeenCalledTimes(1);
    const children = createList.mock.calls[0]![4]!.listChildren!;
    expect(children.map(ref => __SerializeElementTemplate(ref).attributeSlots)).toEqual([['fallback']]);
    const updates = flushInitialElementTemplateListUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0]!.attributes['update-list-info']).toMatchObject({
      insertAction: [{ 'item-key': 'fallback' }],
    });
  });

  it('discards pending list items when a later child fails before its list is created', () => {
    function Failure(): never {
      throw new Error('list child failed');
    }
    const createItem = vi.spyOn(globalThis, '__CreateElementTemplate');
    expect(() =>
      renderToElementTemplate(h('list', {
        $0: [
          h('__Card__:_et_suspense_leaf', {
            attributeSlots: ['abandoned'],
            __listItemPlatformInfo: { 'item-key': 'abandoned' },
          }),
          h(Failure, null),
        ],
      }))
    ).toThrow('list child failed');

    const abandonedUid = __SerializeElementTemplate(createItem.mock.results[0]!.value).uid;
    expect(() => createElementTemplateListState([abandonedUid])).toThrow('non-list-item root');
    expect(flushInitialElementTemplateListUpdates()).toEqual([]);
  });

  it('does not flush a completed list discarded by Suspense', () => {
    const createList = vi.spyOn(globalThis, '__CreateTypedElementTemplate');
    renderToElementTemplate(
      h(Suspense, { fallback: 'loading' }, h('list', { attributes: { id: 'abandoned-list' } }), h(Pending, null)),
    );

    expect(createList).toHaveBeenCalledTimes(1);
    expect(flushInitialElementTemplateListUpdates()).toEqual([]);
  });

  it('does not flush a completed list after an unhandled render failure', () => {
    function Failure(): never {
      throw new Error('later sibling failed');
    }
    const reportError = vi.spyOn(lynx, 'reportError').mockImplementation(() => {});
    const setAttribute = vi.spyOn(globalThis, '__SetAttributeOfElementTemplate');
    const createList = vi.spyOn(globalThis, '__CreateTypedElementTemplate');
    setRoot({ __jsx: [h('list', { attributes: { id: 'abandoned-list' } }), h(Failure, null)] });

    renderMainThread();

    expect(createList).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'later sibling failed' }));
    expect(setAttribute.mock.calls.some(call => call[0] === createList.mock.results[0]!.value)).toBe(false);
    expect(flushInitialElementTemplateListUpdates()).toEqual([]);
  });

  it('replaces abandoned authored page metadata with the fallback page', () => {
    const result = renderToElementTemplate(h(
      Suspense,
      {
        fallback: h(__ElementTemplatePage, { attributes: { id: 'fallback-page' }, $0: 'loading' }),
      },
      h(__ElementTemplatePage, {
        attributes: { id: 'abandoned-page' },
        $0: [leaf('abandoned'), h(Pending, null)],
      }),
    ));

    expect(result.pageAttributes).toEqual({ id: 'fallback-page' });
    expect(result.rootRefs.map(ref => __SerializeElementTemplate(ref).attributeSlots)).toEqual([['loading']]);
  });

  it('clears abandoned page metadata when the fallback has no authored page', () => {
    const result = renderToElementTemplate(h(
      Suspense,
      { fallback: 'loading' },
      h(__ElementTemplatePage, {
        attributes: { id: 'abandoned-page' },
        $0: h(Pending, null),
      }),
    ));

    expect(result.pageAttributes).toBeNull();
    expect(result.rootRefs.map(ref => __SerializeElementTemplate(ref).attributeSlots)).toEqual([['loading']]);
  });
  it.each(['component', 'parent native create', 'parent adapter', 'fallback'])(
    'releases the failed render allocations after %s failure and preserves an earlier render',
    (failure) => {
      __etAttrPlanMap['__Card__:_et_suspense_leaf'] = [1, adaptMTRefAttrSlot, 2, adaptMTEventAttrSlot];
      const statefulLeaf = (id: string, ref: { _wvid: number } | { _wkltId: string }) =>
        h('__Card__:_et_suspense_leaf', { attributeSlots: [id, ref, { _wkltId: `${id}-event` }] });
      const previous = renderToElementTemplate([
        statefulLeaf('previous', { _wvid: 201 }),
        h('list', { attributes: { id: 'live-list' } }),
      ]);
      const previousUid = __SerializeElementTemplate(previous.rootRefs[0]!).uid;
      const liveListUid = __SerializeElementTemplate(previous.rootRefs[1]!).uid;
      expect(getMainThreadDynamicAttrState(previousUid, 1)).toMatchObject({ kind: 'mt-ref' });
      expect(getMainThreadDynamicAttrState(previousUid, 2)).toMatchObject({ kind: 'mt-event' });
      const createNative = globalThis.__CreateElementTemplate;
      const create = vi.spyOn(globalThis, '__CreateElementTemplate').mockImplementation((...args) => {
        if (failure === 'parent native create' && args[0] === '_et_suspense_root') {
          throw new Error('render failed');
        }
        return createNative(...args);
      });
      const createList = vi.spyOn(globalThis, '__CreateTypedElementTemplate');
      const failParentAdapter = vi.fn((_uid: number) => {
        throw new Error('render failed');
      });
      if (failure === 'parent adapter') {
        __etAttrPlanMap['_et_suspense_root'] = [0, failParentAdapter];
      }
      function Failure(): never {
        throw new Error('render failed');
      }
      const children = [
        statefulLeaf('abandoned-object', { _wvid: 202 }),
        statefulLeaf('abandoned-callback', { _wkltId: 'abandoned-ref' }),
        h('list', { attributes: { id: 'abandoned-list' } }),
      ];
      const root = failure === 'fallback'
        ? h(
          Suspense,
          {
            fallback: [statefulLeaf('failed-fallback', { _wvid: 203 }), h(Failure, null)],
          },
          ...children,
          h(Pending, null),
        )
        : h('_et_suspense_root', { $0: failure === 'component' ? [...children, h(Failure, null)] : children });
      const previousWorkletImpl = globalThis.lynxWorkletImpl;
      const previousRunWorklet = globalThis.runWorklet;
      const updateWorkletRef = vi.fn();
      globalThis.lynxWorkletImpl = {
        ...previousWorkletImpl,
        _refImpl: { updateWorkletRef },
      } as typeof globalThis.lynxWorkletImpl;
      globalThis.runWorklet = vi.fn();
      try {
        expect(() => renderToElementTemplate(root)).toThrow('render failed');
        // These refs never attached, so abandoning them must not invoke a null
        // ref callback or a callback cleanup while releasing the stored state.
        expect(updateWorkletRef).not.toHaveBeenCalled();
        expect(globalThis.runWorklet).not.toHaveBeenCalled();
        const abandonedUids = [
          ...create.mock.calls.map(call => call[4]),
          ...createList.mock.calls.map(call => call[3]),
          ...failParentAdapter.mock.calls.map(call => call[0]),
        ];
        for (const uid of abandonedUids) {
          expect(elementTemplateRegistry.has(uid)).toBe(false);
          expect(getMainThreadDynamicAttrState(uid, 1)).toBeUndefined();
          expect(getMainThreadDynamicAttrState(uid, 2)).toBeUndefined();
        }
        expect(elementTemplateRegistry.get(previousUid)).toBe(previous.rootRefs[0]);
        expect(elementTemplateRegistry.get(liveListUid)).toBe(previous.rootRefs[1]);
        expect(getMainThreadDynamicAttrState(previousUid, 1)).toMatchObject({ kind: 'mt-ref' });
        expect(getMainThreadDynamicAttrState(previousUid, 2)).toMatchObject({ kind: 'mt-event' });
        expect(flushInitialElementTemplateListUpdates().map(update => update.uid)).toEqual([liveListUid]);
        const retry = renderToElementTemplate(leaf('retry'));
        expect(__SerializeElementTemplate(retry.rootRefs[0]!).uid).toBeLessThan(Math.min(...abandonedUids));
      } finally {
        globalThis.lynxWorkletImpl = previousWorkletImpl;
        globalThis.runWorklet = previousRunWorklet;
      }
    },
  );

  it('releases both abandoned content and a suspending inner fallback while preserving outer siblings', () => {
    __etAttrPlanMap['__Card__:_et_suspense_leaf'] = [1, adaptMTRefAttrSlot, 2, adaptMTEventAttrSlot];
    const statefulLeaf = (id: string) =>
      h('__Card__:_et_suspense_leaf', { attributeSlots: [id, { _wkltId: `${id}-ref` }, { _wkltId: `${id}-event` }] });
    const create = vi.spyOn(globalThis, '__CreateElementTemplate');
    const result = renderToElementTemplate([
      statefulLeaf('outside'),
      h('list', { attributes: { id: 'live-list' } }),
      h(
        Suspense,
        { fallback: statefulLeaf('outer-fallback') },
        h(
          Suspense,
          { fallback: [statefulLeaf('inner-fallback'), h(Pending, null)] },
          statefulLeaf('abandoned'),
          h(Pending, null),
        ),
      ),
      statefulLeaf('after'),
    ]);
    const liveIds = result.rootRefs.map(ref => __SerializeElementTemplate(ref).uid);
    expect(result.rootRefs.map(ref => __SerializeElementTemplate(ref).attributeSlots?.[0])).toEqual([
      'outside',
      undefined,
      'outer-fallback',
      'after',
    ]);
    for (const call of create.mock.calls) {
      const uid = call[4];
      if (liveIds.includes(uid)) {
        expect(elementTemplateRegistry.has(uid)).toBe(true);
        expect(getMainThreadDynamicAttrState(uid, 1)).toMatchObject({ kind: 'mt-ref' });
        expect(getMainThreadDynamicAttrState(uid, 2)).toMatchObject({ kind: 'mt-event' });
      } else {
        expect(elementTemplateRegistry.has(uid)).toBe(false);
        expect(getMainThreadDynamicAttrState(uid, 1)).toBeUndefined();
        expect(getMainThreadDynamicAttrState(uid, 2)).toBeUndefined();
      }
    }
    expect(new Set(create.mock.calls.map(call => call[4])).size).toBe(create.mock.calls.length);
    expect(flushInitialElementTemplateListUpdates().map(update => update.uid)).toEqual([liveIds[1]]);
  });
});
