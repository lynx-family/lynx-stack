import { describe, expect, it } from 'vitest';

import * as ElementTemplateRuntime from '../../../src/element-template/index.js';
import * as ElementTemplateInternal from '../../../src/element-template/internal.js';
import { SnapshotInstance } from '../../../src/element-template/internal.js';

describe('legacy internal guardrail', () => {
  it('fails fast when stale SnapshotInstance imports reach the ET entry', () => {
    expect(() => new SnapshotInstance('div')).toThrowError(
      'SnapshotInstance should not be instantiated when using Element Template.',
    );
  });

  it('keeps ref attr slot adapter on the ET internal surface only', () => {
    expect(ElementTemplateInternal.adaptRefAttrSlot).toBeTypeOf('function');
    expect('adaptRefAttrSlot' in ElementTemplateRuntime).toBe(false);
  });
});
