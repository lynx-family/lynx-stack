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

  it('keeps the ET main-thread event loader surface minimal', () => {
    expect(ElementTemplateInternal.loadWorkletRuntime).toBeTypeOf('function');
    expect('loadWorkletRuntime' in ElementTemplateRuntime).toBe(false);

    expect(ElementTemplateInternal.registerWorkletOnBackground).toBeTypeOf('function');
    expect(() => ElementTemplateInternal.registerWorkletOnBackground('main-thread', 'hash', () => {})).not.toThrow();
    expect('registerWorkletOnBackground' in ElementTemplateRuntime).toBe(false);
    expect(ElementTemplateInternal.transformToWorklet).toBeTypeOf('function');
    expect('transformToWorklet' in ElementTemplateRuntime).toBe(false);
    expect(ElementTemplateRuntime.runOnBackground).toBeTypeOf('function');
    expect(ElementTemplateRuntime.runOnMainThread).toBeTypeOf('function');
    expect('updateWorkletEvent' in ElementTemplateInternal).toBe(false);
    expect('updateWorkletRef' in ElementTemplateInternal).toBe(false);
  });
});
