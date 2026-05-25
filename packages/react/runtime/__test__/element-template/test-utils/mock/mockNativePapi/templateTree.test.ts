import { describe, expect, it } from 'vitest';

import {
  instantiateCompiledTemplate,
  insertNodeIntoTemplateInstance,
  serializeTemplateInstance,
  setAttributeSlotOnTemplateInstance,
} from './templateTree.js';
import type { CompiledTemplateNode } from './templateTree.js';

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

  it('serializes typed nodes with attributeSlots and omits function fields', () => {
    const child = {
      templateId: '_et_builtin_raw_text',
      attributes: { text: 'row' },
      children: [],
      __handleId: 2,
    } satisfies CompiledTemplateNode;
    const componentAtIndex = () => child;
    const root = {
      tag: 'list',
      type: 'list',
      attributes: {},
      children: [child],
      __typedElementType: 'list',
      __handleId: 1,
      __attributeSlots: [{
        'component-at-index': componentAtIndex,
        'update-list-info': { insertAction: [] },
      }],
      __elementSlots: [[child]],
      __options: {
        listChildren: [child],
        callback: componentAtIndex,
      },
    } satisfies CompiledTemplateNode;

    const serializedChild = {
      templateKey: '_et_builtin_raw_text',
      attributeSlots: ['row'],
      elementSlots: [],
      uid: 2,
    };

    expect(serializeTemplateInstance(root)).toEqual({
      type: 'list',
      attributeSlots: [{ 'update-list-info': { insertAction: [] } }],
      elementSlots: [[serializedChild]],
      uid: 1,
      options: {
        listChildren: [serializedChild],
      },
    });
  });

  it('moves typed children between element slots instead of duplicating them', () => {
    const child = { tag: 'view' };
    const root = {
      tag: 'list',
      type: 'list',
      attributes: {},
      children: [child],
      __typedElementType: 'list',
      __handleId: 1,
      __attributeSlots: null,
      __elementSlots: [[child], []],
    } satisfies CompiledTemplateNode;

    insertNodeIntoTemplateInstance(root, 1, child, null);

    expect(root.__elementSlots).toEqual([[], [child]]);
    expect(root.children).toEqual([]);
  });
});
