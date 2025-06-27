import { expect } from 'chai';
import { sortRoots } from './utils';

const div = (id: string) => {
  const el = document.createElement('div');
  el.id = id;
  return el;
};

describe('sortRoots', () => {
  let scratch: HTMLElement;

  beforeEach(() => {
    scratch = document.createElement('div');
    scratch.id = 'scratch';
  });

  afterEach(() => {
    scratch.remove();
  });

  it('should do nothing if no other root is known', () => {
    const app1 = div('app-1');
    scratch.append(app1);

    const res = sortRoots(scratch, [{ id: 1, node: app1 }]);
    expect(res).to.deep.equal([1]);
  });

  it('should sort if another root is present', () => {
    const app1 = div('app-1');
    const app2 = div('app-2');

    scratch.append(app1);
    scratch.append(app2);

    const res = sortRoots(scratch, [
      { id: 2, node: app2 },
      { id: 1, node: app1 },
    ]);
    expect(res).to.deep.equal([1, 2]);
  });

  it('should sort if multiple other roots are present', () => {
    const app1 = div('app-1');
    const app2 = div('app-2');
    const app3 = div('app-3');

    scratch.append(app1);
    scratch.append(app2);
    scratch.append(app3);

    const res = sortRoots(scratch, [
      { id: 2, node: app2 },
      { id: 3, node: app3 },
      { id: 1, node: app1 },
    ]);
    expect(res).to.deep.equal([1, 2, 3]);
  });

  it('should sort if root includes another root', () => {
    const app1 = div('app-1');
    const app2 = div('app-2');

    scratch.append(app1);
    app1.append(app2);

    const res = sortRoots(scratch, [
      { id: 2, node: app2 },
      { id: 1, node: app1 },
    ]);
    expect(res).to.deep.equal([1, 2]);
  });

  it('should sort in variable depth', () => {
    const app1 = div('app-1');
    const child1 = div('child1');
    const app2 = div('app-2');

    scratch.append(app1);
    scratch.append(child1);
    child1.append(app2);

    const res = sortRoots(scratch, [
      { id: 2, node: app2 },
      { id: 1, node: app1 },
    ]);
    expect(res).to.deep.equal([1, 2]);
  });

  it.skip('should sort with same container', () => {
    const app1 = div('app-1');

    scratch.append(app1);

    const res = sortRoots(scratch, [
      { id: 2, node: app1 },
      { id: 1, node: app1 },
    ]);
    expect(res).to.deep.equal([1, 2]);
  });
});
