import { describe, expect, test, vi } from 'vitest';
import { globalEnvManager } from '../utils/envManager.ts';

describe('processEvalResult', () => {
  test('main-thread', async () => {
    globalEnvManager.switchToMainThread();

    await import('../../src/index.ts');

    expect(processEvalResult).toStrictEqual(expect.any(Function));

    const fn = vi.fn().mockReturnValue('bar');

    expect(processEvalResult(fn, 'https://example.com/')).toBe('bar');
    expect(fn).toBeCalledWith('https://example.com/');
  });

  test('call with undefined', () => {
    globalEnvManager.switchToMainThread();

    expect(processEvalResult(undefined, 'https://example.com/')).toBeUndefined();
  });
});
