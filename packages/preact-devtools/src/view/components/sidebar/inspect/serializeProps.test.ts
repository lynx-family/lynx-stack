import { expect } from 'chai';
import { serializeProps } from './serializeProps';

describe('serializeProps', () => {
  it('should serialize primitives', () => {
    expect(serializeProps('foo')).to.equal('foo');
    expect(serializeProps('')).to.equal('');
    expect(serializeProps(2)).to.equal(2);
    expect(serializeProps(0)).to.equal(0);
    expect(serializeProps(true)).to.equal(true);
    expect(serializeProps(false)).to.equal(false);
    expect(serializeProps(null)).to.equal(null);
  });

  it('should serialize arrays', () => {
    expect(serializeProps([1, 2, 3])).to.deep.equal([1, 2, 3]);
    expect(serializeProps([{ type: 'vnode', name: 'div' }])).to.deep.equal([
      '<div />',
    ]);
  });

  it('should serialize VNodes', () => {
    expect(serializeProps({ type: 'vnode', name: 'div' })).to.equal('<div />');
  });

  it('should serialize functions', () => {
    expect(serializeProps({ type: 'function', name: 'foo' })).to.equal('foo()');
  });

  it('should serialize bigints', () => {
    expect(serializeProps({ type: 'bigint', value: '3' })).to.equal('3n');
  });
});
