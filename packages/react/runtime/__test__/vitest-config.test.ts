import { describe, expect, it } from 'vitest';

import config from '../vitest.config';

describe('runtime vitest config', () => {
  it('should exclude runtime-owned worklet publish outputs from coverage', () => {
    const exclude = config.test?.coverage?.exclude ?? [];

    expect(exclude).toContain('worklet-runtime/**');
    expect(exclude).toContain('rslib.worklet-runtime.config.ts');
  });
});
