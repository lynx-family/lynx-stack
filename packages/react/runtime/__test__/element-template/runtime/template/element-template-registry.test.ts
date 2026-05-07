import { describe, expect, it } from 'vitest';

import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';

describe('elementTemplateRegistry (nativeRef)', () => {
  it('stores and resolves negative ids via dense array', () => {
    elementTemplateRegistry.clear();

    const ref1 = { ref: 1 } as unknown as ElementRef;
    const ref2 = { ref: 2 } as unknown as ElementRef;

    elementTemplateRegistry.set(-1, ref1);
    elementTemplateRegistry.set(-2, ref2);

    expect(elementTemplateRegistry.get(-1)).toBe(ref1);
    expect(elementTemplateRegistry.get(-2)).toBe(ref2);
    expect(elementTemplateRegistry.has(-1)).toBe(true);
    expect(elementTemplateRegistry.has(-2)).toBe(true);
  });

  it('stores and resolves non-negative ids via Map fallback', () => {
    elementTemplateRegistry.clear();

    const ref = { ref: 7 } as unknown as ElementRef;
    elementTemplateRegistry.set(7, ref);

    expect(elementTemplateRegistry.get(7)).toBe(ref);
    expect(elementTemplateRegistry.has(7)).toBe(true);
  });

  it('deletes ids and clears all', () => {
    elementTemplateRegistry.clear();

    const negRef = { ref: -1 } as unknown as ElementRef;
    const posRef = { ref: 1 } as unknown as ElementRef;

    elementTemplateRegistry.set(-1, negRef);
    elementTemplateRegistry.set(1, posRef);

    elementTemplateRegistry.delete(-1);
    expect(elementTemplateRegistry.get(-1)).toBeUndefined();
    expect(elementTemplateRegistry.has(-1)).toBe(false);
    expect(elementTemplateRegistry.get(1)).toBe(posRef);

    elementTemplateRegistry.delete(1);
    expect(elementTemplateRegistry.get(1)).toBeUndefined();
    expect(elementTemplateRegistry.has(1)).toBe(false);

    elementTemplateRegistry.clear();
    expect(elementTemplateRegistry.get(1)).toBeUndefined();
    expect(elementTemplateRegistry.has(1)).toBe(false);
  });
});
