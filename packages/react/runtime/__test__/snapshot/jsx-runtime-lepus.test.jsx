import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { jsx } from '../../lepus/jsx-runtime';
import { SnapshotInstance, snapshotCreatorMap } from '../../src/snapshot';

describe('lepus jsx-runtime createVNode', () => {
  beforeEach(() => {
    snapshotCreatorMap['view'] = () => {};
  });

  afterEach(() => {
    delete snapshotCreatorMap['view'];
  });

  it('should create SnapshotInstance for string type', () => {
    const vnode = jsx('view', { id: 'x' });
    expect(vnode).toBeInstanceOf(SnapshotInstance);
  });

  it('should strip ref and apply defaultProps for function components', () => {
    function Foo() {
      return null;
    }
    Foo.defaultProps = { foo: 'bar' };

    const vnode = jsx(Foo, { foo: undefined, ref: 'ref', extra: 1 });
    expect(vnode.props.foo).toBe('bar');
    expect(vnode.props.extra).toBe(1);
    expect('ref' in vnode.props).toBe(false);
  });

  it('should not override provided props when defaultProps exists', () => {
    function Baz() {
      return null;
    }
    Baz.defaultProps = { foo: 'bar' };

    const vnode = jsx(Baz, { foo: 'baz' });
    expect(vnode.props.foo).toBe('baz');
  });

  it('should pass props through when no ref/defaultProps', () => {
    function Bar() {
      return null;
    }

    const vnode = jsx(Bar, { foo: 'baz' });
    expect(vnode.props).toEqual({ foo: 'baz' });
  });

  it('should return undefined for non-string/non-function types', () => {
    const vnode = jsx(null, {});
    expect(vnode).toBeUndefined();
  });
});
