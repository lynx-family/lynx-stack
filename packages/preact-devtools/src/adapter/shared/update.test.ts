import { expect } from 'chai';
import { setInCopy } from './serialize';

describe('setInCopy', () => {
  it('should update arrays', () => {
    const obj = { foo: [1] };
    const res = setInCopy(obj, ['foo', 0], 2);
    expect(res).to.deep.equal({
      foo: [2],
    });
    expect(res).not.equal(obj);
    expect(res.foo).not.equal(obj.foo);
  });

  it('should not mutate existing object', () => {
    const obj = { foo: { bar: 1 } };
    const res = setInCopy(obj, ['foo', 'bar'], 2);
    expect(res).to.deep.equal({
      foo: { bar: 2 },
    });
    expect(res).not.equal(obj);
    expect(res.foo).not.equal(obj.foo);
  });

  it('should update value in Set', () => {
    const obj = { foo: new Set([{ bar: 1 }]) };
    const res = setInCopy(obj, ['foo', 'bar'], 2);
    expect(Array.from(res.foo.values())).to.deep.equal([{ bar: 1 }, 2]);
    expect(res).not.equal(obj);
    expect(res.foo).not.equal(obj.foo);
  });

  describe('Map', () => {
    it('should update value', () => {
      const obj = { foo: new Map([[{ bar: 'foo' }, 1]]) };
      const res = setInCopy(obj, ['foo', '0', '1'], 2);
      expect(res).to.deep.equal({
        foo: new Map([[{ bar: 'foo' }, 2]]),
      });
      expect(res).not.equal(obj);
      expect(res.foo).not.equal(obj.foo);
    });

    it('should update key', () => {
      const obj = { foo: new Map([[{ bar: 'foo' }, 1]]) };
      const res = setInCopy(obj, ['foo', '0', '0', 'bar'], 'bar');
      expect(Array.from(res.foo.entries())).to.deep.equal([
        [{ bar: 'bar' }, 1],
      ]);
      expect(res).not.equal(obj);
      expect(res.foo).not.equal(obj.foo);
    });
  });
});
