import { expect } from 'chai';
import { parseProps } from './parseProps';

const serialize = (v: Map<any, any>) => Array.from(v.values());

describe('parseProps', () => {
  it('should flatten strings', () => {
    const tree = parseProps('foo', 'foo', 2);

    expect(serialize(tree)).to.deep.equal([
      {
        editable: true,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'string',
        value: 'foo',
        children: [],
        meta: null,
      },
    ]);
  });

  it('should flatten numbers', () => {
    const tree = parseProps(12, 'foo', 2);

    expect(serialize(tree)).to.deep.equal([
      {
        editable: true,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'number',
        value: 12,
        children: [],
        meta: null,
      },
    ]);
  });

  it('should flatten booleans', () => {
    const tree = parseProps(false, 'foo', 2);

    expect(serialize(tree)).to.deep.equal([
      {
        editable: true,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'boolean',
        value: false,
        children: [],
        meta: null,
      },
    ]);
  });

  it('should flatten null', () => {
    const tree = parseProps(null, 'foo', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'null',
        value: null,
        children: [],
        meta: null,
      },
    ]);
  });

  it('should flatten undefined', () => {
    const tree = parseProps(undefined, 'foo', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'undefined',
        value: undefined,
        children: [],
        meta: null,
      },
    ]);
  });

  it('should parse bigints', () => {
    const big = {
      type: 'bigint',
      value: '3',
    };
    const tree = parseProps(big, 'foo', 2);

    expect(serialize(tree)).to.deep.equal([
      {
        editable: true,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'bigint',
        value: big,
        children: [],
        meta: null,
      },
    ]);
  });

  it('should parse functions', () => {
    const fn = {
      type: 'function',
      name: 'fooBar',
    };
    const tree = parseProps(fn, 'foo', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'function',
        value: fn,
        children: [],
        meta: null,
      },
    ]);
  });

  it('should flatten arrays', () => {
    const tree = parseProps([1, 2], 'foo', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'array',
        value: [1, 2],
        children: ['foo.0', 'foo.1'],
        meta: null,
      },
      {
        editable: true,
        depth: 1,
        id: 'foo.0',
        name: '0',
        type: 'number',
        value: 1,
        children: [],
        meta: null,
      },
      {
        editable: true,
        depth: 1,
        id: 'foo.1',
        name: '1',
        type: 'number',
        value: 2,
        children: [],
        meta: null,
      },
    ]);
  });

  it('should not mark empty arrays as collapsible', () => {
    const tree = parseProps([], 'foo', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'array',
        value: [],
        children: [],
        meta: null,
      },
    ]);
  });

  it('should flatten objects', () => {
    const tree = parseProps({ foo: 123, bar: 'abc' }, '', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: '',
        name: '',
        type: 'object',
        value: {
          foo: 123,
          bar: 'abc',
        },
        children: ['.foo', '.bar'],
        meta: null,
      },
      {
        editable: true,
        depth: 1,
        id: '.foo',
        name: 'foo',
        type: 'number',
        value: 123,
        children: [],
        meta: null,
      },
      {
        editable: true,
        depth: 1,
        id: '.bar',
        name: 'bar',
        type: 'string',
        value: 'abc',
        children: [],
        meta: null,
      },
    ]);
  });

  it('should flatten nested objects', () => {
    const tree = parseProps({ foo: { bar: 'abc' } }, 'foo', 4);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'object',
        value: {
          foo: {
            bar: 'abc',
          },
        },
        children: ['foo.foo'],
        meta: null,
      },
      {
        editable: false,
        depth: 1,
        id: 'foo.foo',
        name: 'foo',
        type: 'object',
        value: {
          bar: 'abc',
        },
        children: ['foo.foo.bar'],
        meta: null,
      },
      {
        editable: true,
        depth: 2,
        id: 'foo.foo.bar',
        name: 'bar',
        type: 'string',
        value: 'abc',
        children: [],
        meta: null,
      },
    ]);
  });

  it('should flatten plain objects that are read as \'maybeCollections\'', () => {
    const tree = parseProps({ foo: 123, bar: 'abc', name: 'bob' }, '', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: '',
        name: '',
        type: 'object',
        value: {
          foo: 123,
          bar: 'abc',
          name: 'bob',
        },
        children: ['.foo', '.bar', '.name'],
        meta: null,
      },
      {
        editable: true,
        depth: 1,
        id: '.foo',
        name: 'foo',
        type: 'number',
        value: 123,
        children: [],
        meta: null,
      },
      {
        editable: true,
        depth: 1,
        id: '.bar',
        name: 'bar',
        type: 'string',
        value: 'abc',
        children: [],
        meta: null,
      },
      {
        editable: true,
        depth: 1,
        id: '.name',
        name: 'name',
        type: 'string',
        value: 'bob',
        children: [],
        meta: null,
      },
    ]);
  });

  it('should limit depth', () => {
    const tree = parseProps({ foo: { bar: { boof: 'abc' } } }, 'foo', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: 'foo',
        name: 'foo',
        type: 'object',
        value: {
          foo: {
            bar: { boof: 'abc' },
          },
        },
        children: ['foo.foo'],
        meta: null,
      },
      {
        editable: false,
        depth: 1,
        id: 'foo.foo',
        name: 'foo',
        type: 'object',
        value: {
          bar: { boof: 'abc' },
        },
        children: ['foo.foo.bar'],
        meta: null,
      },
      {
        editable: false,
        depth: 2,
        id: 'foo.foo.bar',
        name: 'bar',
        type: 'string',
        value: '…',
        children: [],
        meta: null,
      },
    ]);
  });

  it('should not mark [[Circular]] reference as editable', () => {
    const tree = parseProps('[[Circular]]', '', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: '',
        name: '',
        type: 'string',
        value: '[[Circular]]',
        children: [],
        meta: null,
      },
    ]);
  });

  it('should not mark Symbols as editable', () => {
    const tree = parseProps({ type: 'symbol', name: 'Symbol(foo)' }, '', 2);
    expect(serialize(tree)).to.deep.equal([
      {
        editable: false,
        depth: 0,
        id: '',
        name: '',
        type: 'symbol',
        value: {
          type: 'symbol',
          name: 'Symbol(foo)',
        },
        children: [],
        meta: null,
      },
    ]);
  });
});
