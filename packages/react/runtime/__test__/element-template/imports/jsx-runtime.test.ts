import { describe, expect, it } from 'vitest';

import { jsx } from '@lynx-js/react/element-template/jsx-runtime';
import { jsxDEV } from '@lynx-js/react/element-template/jsx-dev-runtime';

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

  it('normalizes missing host props to an empty object', () => {
    const vnode = jsx('view', null);

    expect(vnode?.props).toEqual({});
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

  it('returns undefined for unsupported vnode types', () => {
    expect(jsx(null, null)).toBeUndefined();
  });

  it('exposes the same host vnode shape from the dev runtime entry', () => {
    const vnode = jsxDEV('view', { id: 'dev' });

    expect(vnode).toMatchObject({
      type: 'view',
      props: { id: 'dev' },
      __k: null,
      __: null,
      __b: 0,
      __e: null,
      __d: undefined,
      __c: null,
      __i: -1,
      __u: 0,
    });
  });
});
