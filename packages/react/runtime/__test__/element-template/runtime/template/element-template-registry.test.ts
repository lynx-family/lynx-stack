import { describe, expect, it } from 'vitest';

import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';

describe('ElementTemplateRegistry (nativeRef)', () => {
  it('stores and resolves negative ids via dense array', () => {
    ElementTemplateRegistry.clear();

    const ref1 = { ref: 1 } as unknown as ElementRef;
    const ref2 = { ref: 2 } as unknown as ElementRef;

    ElementTemplateRegistry.set(-1, ref1);
    ElementTemplateRegistry.set(-2, ref2);

    expect(ElementTemplateRegistry.get(-1)).toBe(ref1);
    expect(ElementTemplateRegistry.get(-2)).toBe(ref2);
    expect(ElementTemplateRegistry.has(-1)).toBe(true);
    expect(ElementTemplateRegistry.has(-2)).toBe(true);
  });

  it('stores and resolves non-negative ids via Map fallback', () => {
    ElementTemplateRegistry.clear();

    const ref = { ref: 7 } as unknown as ElementRef;
    ElementTemplateRegistry.set(7, ref);

    expect(ElementTemplateRegistry.get(7)).toBe(ref);
    expect(ElementTemplateRegistry.has(7)).toBe(true);
  });

  it('deletes ids and clears all', () => {
    ElementTemplateRegistry.clear();

    const negRef = { ref: -1 } as unknown as ElementRef;
    const posRef = { ref: 1 } as unknown as ElementRef;

    ElementTemplateRegistry.set(-1, negRef);
    ElementTemplateRegistry.set(1, posRef);

    ElementTemplateRegistry.delete(-1);
    expect(ElementTemplateRegistry.get(-1)).toBeUndefined();
    expect(ElementTemplateRegistry.has(-1)).toBe(false);
    expect(ElementTemplateRegistry.get(1)).toBe(posRef);

    ElementTemplateRegistry.delete(1);
    expect(ElementTemplateRegistry.get(1)).toBeUndefined();
    expect(ElementTemplateRegistry.has(1)).toBe(false);

    ElementTemplateRegistry.clear();
    expect(ElementTemplateRegistry.get(1)).toBeUndefined();
    expect(ElementTemplateRegistry.has(1)).toBe(false);
  });
});
