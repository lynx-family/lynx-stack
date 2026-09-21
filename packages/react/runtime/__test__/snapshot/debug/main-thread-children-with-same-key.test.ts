import { expect, it, vi } from 'vitest';

it.each([false, true])('preact/debug - Snapshot main-thread children with duplicate keys: %s', async (duplicate) => {
  vi.stubGlobal('__MAIN_THREAD__', true)
    .stubGlobal('__LEPUS__', true)
    .stubGlobal('__BACKGROUND__', false);
  await import('preact/debug');
  const { h } = await import('preact');
  const { jsx } = await import('../../../lepus/jsx-runtime/index.js');
  const { default: renderToString } = await import('../../../src/snapshot/renderToOpcodes/index.js');
  const { __root } = await import('../../../src/root.js');
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const Child = () => null;
  const children = ['first', duplicate ? 'first' : 'second'].map(key => h(Child, { key }));
  const host = jsx('view', { children });
  try {
    expect(() => renderToString(host, null, __root)).not.toThrow();
    if (duplicate) {
      expect(error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('same key attribute: "first"'));
      expect(error.mock.calls[0]![0]).toContain('<view');
    } else {
      expect(error).not.toHaveBeenCalled();
    }
  } finally {
    error.mockRestore();
    vi.unstubAllGlobals();
  }
});
