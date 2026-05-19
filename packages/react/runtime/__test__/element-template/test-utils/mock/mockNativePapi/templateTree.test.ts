import { describe, expect, it } from 'vitest';

import { instantiateCompiledTemplate, setAttributeSlotOnTemplateInstance } from './templateTree.js';
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
});
