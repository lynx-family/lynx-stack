import { describe, it, expect, vi } from 'vitest';
import ReactLynx from '@lynx-js/react';
import { startTransition as preactStartTransition, useTransition as preactUseTransition } from 'preact/compat';

import compat from '../../compat';

describe('Default export', () => {
  it('should include all exports from @lynx-js/react', () => {
    Object.keys(ReactLynx).forEach(key => {
      expect(compat).toHaveProperty(key);
      expect(compat[key]).toBe(ReactLynx[key]);
    });
  });

  it('should include startTransition and useTransition', () => {
    expect(compat).toHaveProperty('startTransition');
    expect(compat.startTransition).toBe(preactStartTransition);

    expect(compat).toHaveProperty('useTransition');
    expect(compat.useTransition).toBe(preactUseTransition);
  });

  it('should have correct number of exports', () => {
    // +2 for startTransition and useTransition
    const expectedExportCount = Object.keys(ReactLynx).length + 2;
    expect(Object.keys(compat).length).toBe(expectedExportCount);
  });
});
