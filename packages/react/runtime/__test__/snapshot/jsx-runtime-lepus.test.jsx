import { isValidElement as coreIsValidElement } from 'preact';
import { isValidElement } from 'preact/compat';
import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';

import { cloneElement, createElement } from '../../lepus';
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

  it('should keep ref and apply defaultProps for function components', () => {
    function Foo() {
      return null;
    }
    Foo.defaultProps = { foo: 'bar' };

    const vnode = jsx(Foo, { foo: undefined, ref: 'ref', extra: 1 });
    expect(vnode.props.foo).toBe('bar');
    expect(vnode.props.extra).toBe(1);
    expect(vnode.props.ref).toBe('ref');
  });

  it('should strip ref for class components', () => {
    class Foo {
      render() {
        return null;
      }
    }

    const vnode = jsx(Foo, { ref: 'ref', extra: 1 });
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

  it('should create vnodes that isValidElement recognizes', () => {
    function Foo() {
      return null;
    }

    expect(isValidElement(jsx('view', {}))).toBe(true);
    expect(isValidElement(jsx(Foo, {}))).toBe(true);
    expect(isValidElement(createElement('view', {}))).toBe(true);
    expect(isValidElement(createElement(Foo, {}))).toBe(true);
    expect(isValidElement(cloneElement(jsx(Foo, {}), { foo: 1 }))).toBe(true);
  });

  it('should not make SnapshotInstance a preact vnode', () => {
    // `renderToOpcodes` tells a preact vnode from a SnapshotInstance with
    // preact core's `isValidElement`, which keys on `constructor` rather than
    // `$$typeof`, so tagging the latter must not disturb it.
    expect(coreIsValidElement(jsx('view', {}))).toBe(false);
  });
});
