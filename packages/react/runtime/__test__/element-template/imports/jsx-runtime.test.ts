import { describe, expect, it } from 'vitest';

import { jsx } from '@lynx-js/react/jsx-runtime';

describe('element-template jsx-runtime', () => {
  it('creates plain vnode objects for host string nodes', () => {
    const vnode = jsx('view', { id: 'x' });

    expect(vnode).toMatchObject({
      type: 'view',
      props: { id: 'x' },
      __k: null,
      __: null,
      __b: 0,
      __e: null,
      __d: undefined,
      __c: null,
      __i: -1,
      __u: 0,
    });
    expect(vnode.constructor).toBeUndefined();
  });

  it('strips ref and applies defaultProps for function components', () => {
    function Foo() {
      return null;
    }
    Foo.defaultProps = { foo: 'bar' };

    const vnode = jsx(Foo, { foo: undefined, ref: 'ref', extra: 1 });

    expect(vnode.props).toEqual({
      foo: 'bar',
      extra: 1,
    });
  });
});
