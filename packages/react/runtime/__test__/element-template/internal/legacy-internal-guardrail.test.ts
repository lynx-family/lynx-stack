import { describe, expect, it } from 'vitest';

import { SnapshotInstance } from '../../../src/element-template/internal.js';

describe('legacy internal guardrail', () => {
  it('fails fast when stale SnapshotInstance imports reach the ET entry', () => {
    expect(() => new SnapshotInstance('div')).toThrowError(
      'SnapshotInstance should not be instantiated when using Element Template.',
    );
  });
});
