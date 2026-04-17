import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { jsx } from '../lepus/jsx-runtime';
import { SnapshotInstance, snapshotCreatorMap } from '../src/snapshot';

describe('lepus jsx-runtime createVNode', () => {
  let originalUseElementTemplate;

  beforeEach(() => {
    originalUseElementTemplate = globalThis.__USE_ELEMENT_TEMPLATE__;
    snapshotCreatorMap['view'] = () => {};
  });

  afterEach(() => {
    globalThis.__USE_ELEMENT_TEMPLATE__ = originalUseElementTemplate;
    delete snapshotCreatorMap['view'];
  });

  it('should create plain VNode for string type when element template is ON', () => {
    globalThis.__USE_ELEMENT_TEMPLATE__ = true;
    const vnode = jsx('view', { id: 'x' });
    expect(vnode.type).toBe('view');
    expect(vnode.constructor).toBeUndefined();
  });

  it('should default props to empty object when element template is ON', () => {
    globalThis.__USE_ELEMENT_TEMPLATE__ = true;
    const vnode = jsx('view');
    expect(vnode.props).toEqual({});
  });

  it('should create SnapshotInstance for string type when element template is OFF', () => {
    globalThis.__USE_ELEMENT_TEMPLATE__ = false;
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
