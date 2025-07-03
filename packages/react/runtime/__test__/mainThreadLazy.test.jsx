import { describe, it, expect } from 'vitest';
import renderToString from '../src/renderToOpcodes/index.ts';
import { mainThreadLazy, makeSyncThen } from '../src/lynx/lazy-bundle.ts';

describe('mainThreadLazy', () => {
  function App() {
    return <view></view>;
  }

  it('should not throw when async', () => {
    const Lazy = mainThreadLazy(() => Promise.resolve({ default: App }));

    expect(renderToString(<Lazy />)).toMatchInlineSnapshot(`[]`);
  });

  it('should not throw when sync', () => {
    const Lazy = mainThreadLazy(() => {
      const ret = { default: App };
      const r = Promise.resolve(ret);
      r.then = makeSyncThen(ret);
      return r;
    });

    expect(renderToString(<Lazy />)).toMatchInlineSnapshot(`
      [
        0,
        <__Card__:__snapshot_05fe4_test_1 />,
        1,
      ]
    `);
  });
});
