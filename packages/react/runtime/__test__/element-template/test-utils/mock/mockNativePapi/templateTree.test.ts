import { describe, expect, it } from 'vitest';

import {
  instantiateCompiledTemplate,
  insertNodeIntoTemplateInstance,
  serializeTemplateInstance,
  setAttributeSlotOnTemplateInstance,
} from './templateTree.js';
import type { CompiledTemplateNode } from './templateTree.js';
import { registerTemplates } from '../../debug/registry.js';

type CompiledElementTemplate = NonNullable<CompiledTemplateNode['__compiledTemplate']>;

describe('mock native template tree spread slots', () => {
  it('expands spread slots in descriptor order', () => {
    const template = {
      kind: 'element',
      type: 'view',
      attributesArray: [
        { kind: 'static', key: 'id', value: 'static-id' },
        { kind: 'spread', attrSlotIndex: 0 },
        { kind: 'slot', key: 'id', attrSlotIndex: 1 },
      ],
      children: [],
    } satisfies CompiledElementTemplate;

    const root = instantiateCompiledTemplate(
      template,
      [{ id: 'spread-id', class: 'primary' }, 'slot-id'],
      [],
    );

    expect(root.attributes).toEqual({
      id: 'slot-id',
      class: 'primary',
    });
  });

  it('replaces the whole spread slot when setAttribute updates a template instance', () => {
    const template = {
      kind: 'element',
      type: 'view',
      attributesArray: [
        { kind: 'spread', attrSlotIndex: 0 },
      ],
      children: [],
    } satisfies CompiledElementTemplate;
    const initialSpread = { id: 'cta', class: 'primary' };
    const root = instantiateCompiledTemplate(template, [initialSpread], []);
    root.__compiledTemplate = template;
    root.__attributeSlots = [initialSpread];

    setAttributeSlotOnTemplateInstance(root, 0, { id: 'cta-next' });

    expect(root.__attributeSlots).toEqual([{ id: 'cta-next' }]);
    expect(root.attributes).toEqual({ id: 'cta-next' });
  });

  it('serializes typed nodes with native tag/attributes and omits function fields', () => {
    const child = {
      templateId: '_et_builtin_raw_text',
      attributes: { text: 'row' },
      children: [],
      __handleId: 2,
    } satisfies CompiledTemplateNode;
    const componentAtIndex = () => child;
    const root = {
      tag: 'list',
      attributes: {},
      children: [],
      __typedElementType: 'list',
      __handleId: 1,
      __attributeSlots: [{
        'component-at-index': componentAtIndex,
        'update-list-info': { insertAction: [] },
      }],
      __childSlots: null,
      __options: {
        listChildren: [child],
        estimatedHeight: 80,
        callback: componentAtIndex,
      },
    } satisfies CompiledTemplateNode;

    const serializedChild = {
      templateKey: '_et_builtin_raw_text',
      attributeSlots: ['row'],
      childSlots: [],
      uid: 2,
    };

    expect(serializeTemplateInstance(root)).toEqual({
      tag: 'list',
      attributes: { 'update-list-info': { insertAction: [] } },
      childSlots: null,
      uid: 1,
      options: {
        listChildren: [serializedChild],
        estimatedHeight: 80,
      },
    });
  });

  it('serializes compiled node bundleUrl when native create stored one', () => {
    const root = {
      templateId: '_et_test',
      attributes: {},
      children: [],
      __handleId: 1,
      __compiledTemplate: {
        kind: 'element',
        type: 'view',
        attributesArray: [],
        children: [],
      },
      __attributeSlots: null,
      __bundleUrl: 'dynamic-entry',
    } satisfies CompiledTemplateNode;

    expect(serializeTemplateInstance(root)).toEqual({
      templateKey: '_et_test',
      bundleUrl: 'dynamic-entry',
      attributeSlots: [],
      childSlots: [],
      uid: 1,
    });
  });

  it('keeps generic create and update values in baseline mock storage', () => {
    registerTemplates([{
      templateId: '_et_mock_generic_values',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        attributesArray: [{ kind: 'spread', attrSlotIndex: 0 }],
        children: [{ kind: 'childSlot', type: 'slot', elementSlotIndex: 0 }],
      },
    }]);
    const createTyped = __CreateTypedElementTemplate as (...args: unknown[]) => unknown;
    const createCompiled = __CreateElementTemplate as (...args: unknown[]) => unknown;
    const child = createTyped('view', { text: 'child' }, null, 2, null) as CompiledTemplateNode;
    const sparse = new Array<unknown>(2);
    sparse[1] = child;
    const attributes = { child, invalidNumber: Number.NaN, sparse };
    const options = { child, invalidNumber: Number.NaN, sparse };
    const root = createCompiled(
      '_et_mock_generic_values',
      null,
      [attributes],
      [[child]],
      1,
      options,
    ) as CompiledTemplateNode;

    expect(root.__attributeSlots?.[0]).toBe(attributes);
    expect(root.__options).toBe(options);
    expect(root.attributes).toEqual(attributes);

    const updated = { child, invalidNumber: Number.NaN, sparse };
    (__SetAttributeOfElementTemplate as (...args: unknown[]) => unknown)(
      root,
      0,
      updated,
    );

    expect(root.__attributeSlots?.[0]).toBe(updated);
    expect(root.attributes).toEqual(updated);
  });

  it('moves typed children between child slots instead of duplicating them', () => {
    const child = { tag: 'view' };
    const root = {
      tag: 'list',
      attributes: {},
      children: [child],
      __typedElementType: 'list',
      __handleId: 1,
      __attributeSlots: null,
      __childSlots: [[child], []],
    } satisfies CompiledTemplateNode;

    insertNodeIntoTemplateInstance(root, 1, child, null);

    expect(root.__childSlots).toEqual([[], [child]]);
    expect(root.children).toEqual([]);
  });
});
