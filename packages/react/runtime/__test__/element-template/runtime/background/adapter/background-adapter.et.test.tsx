import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupBackgroundElementTemplateDocument } from '../../../../../src/element-template/background/document.js';
import type { BackgroundElementTemplateDocument } from '../../../../../src/element-template/background/document.js';
import {
  BackgroundElementTemplateInstance,
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
} from '../../../../../src/element-template/background/instance.js';
import { __etSlot } from '../../../../../src/element-template/runtime/components/slot.js';

describe('Background Element Template Adapter', () => {
  let doc: BackgroundElementTemplateDocument;

  beforeEach(() => {
    vi.resetAllMocks();
    doc = setupBackgroundElementTemplateDocument();
  });

  it('creates BackgroundElementTemplateInstance for normal elements', () => {
    const el = doc.createElement('view');
    expect(el).toBeInstanceOf(BackgroundElementTemplateInstance);
    expect(el.type).toBe('view');
    expect(el.text).toBe('');
    expect(el.nodeType).toBe(1);
  });

  it('creates BackgroundElementTemplateSlot for "slot" type', () => {
    const el = doc.createElement('slot');
    expect(el).toBeInstanceOf(BackgroundElementTemplateInstance);
    expect(el.type).toBe('slot');
  });

  it('creates builtin raw-text template instances for text nodes', () => {
    const node = doc.createTextNode('hello');
    expect(node).toBeInstanceOf(BackgroundElementTemplateInstance);
    expect(node.type).toBe(BUILTIN_RAW_TEXT_TEMPLATE_KEY);
    expect(node.text).toBe('hello');
    expect(node.nodeType).toBe(3);
  });

  describe('BackgroundElementTemplateInstance', () => {
    it('supports setAttribute (attributeSlots)', () => {
      const el = new BackgroundElementTemplateInstance('view');
      el.setAttribute('attributeSlots', [{ id: 'test' }]);
      expect(el.attributeSlots[0]).toEqual({ id: 'test' });
    });

    it('supports hierarchy operations', () => {
      const parent = new BackgroundElementTemplateInstance('parent');
      const child1 = new BackgroundElementTemplateInstance('child1');
      const child2 = new BackgroundElementTemplateInstance('child2');

      // Append
      parent.appendChild(child1);
      expect(child1.parent).toBe(parent);
      expect(parent.firstChild).toBe(child1);
      expect(parent.lastChild).toBe(child1);

      // InsertBefore
      parent.insertBefore(child2, child1); // [child2, child1]
      expect(parent.firstChild).toBe(child2);
      expect(parent.lastChild).toBe(child1);
      expect(child2.nextSibling).toBe(child1);
      expect(child1.previousSibling).toBe(child2);

      // Remove
      parent.removeChild(child2);
      expect(parent.firstChild).toBe(child1);
      expect(child2.parent).toBeNull();
    });
  });

  describe('__etSlot', () => {
    it('returns <slot> element in background', () => {
      vi.stubGlobal('__BACKGROUND__', true);
      const vnode = __etSlot(10, 'content') as unknown as {
        type: string;
        props: { id: number; children: unknown };
      };
      expect(vnode).not.toBe('content');
      expect(vnode.type).toBe('slot');
      expect(vnode.props.id).toBe(10);
      expect(vnode.props.children).toBe('content');

      vi.unstubAllGlobals();
    });

    it('throws in main thread (default)', () => {
      vi.stubGlobal('__BACKGROUND__', false);
      expect(() => __etSlot(10, 'content')).toThrow(
        '__etSlot() should not run on the main thread. LEPUS ET children are lowered to slot arrays at compile time.',
      );
      vi.unstubAllGlobals();
    });
  });
});
