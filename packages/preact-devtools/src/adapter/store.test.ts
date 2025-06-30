import { createStore } from '../view/store';
import { applyOperationsV2 } from './protocol/events';
import { expect } from 'chai';
import { fromSnapshot } from './debug';
import * as sinon from 'sinon';
import { effect } from '@preact/signals';

describe('Store', () => {
  it('should apply mounts', () => {
    const store = createStore();
    const event = fromSnapshot([
      'rootId: 1',
      'Add 1 <Fragment> to parent -1',
      'Add 2 <div> to parent 1',
      'Add 3 <span> to parent 2',
      'Add 4 <#text> to parent 3',
      'Add 5 <span> to parent 2',
      'Add 6 <#text> to parent 5',
    ]);
    applyOperationsV2(store, event);

    expect(store.nodes.value.get(1)!.children).to.deep.equal([2]);
    expect(store.nodes.value.get(2)!.children).to.deep.equal([3, 5]);
    expect(store.nodes.value.get(3)!.children).to.deep.equal([4]);
  });

  it('should update durations', () => {
    const store = createStore();
    const event = fromSnapshot([
      'rootId: 1',
      'Add 1 <Fragment> to parent -1',
      'Add 2 <div> to parent 1',
    ]);
    applyOperationsV2(store, event);

    // prettier-ignore
    const event2 = fromSnapshot([
      'rootId: 1',
      'Update timings 1 time 12:15',
    ]);
    applyOperationsV2(store, event2);

    expect(store.nodes.value.get(1)!.startTime).to.equal(12);
    expect(store.nodes.value.get(1)!.endTime).to.equal(15);
  });

  it('should unmount vnodes', () => {
    const store = createStore();
    const event = fromSnapshot([
      'rootId: 1',
      'Add 1 <Fragment> to parent -1',
      'Add 2 <div> to parent 1',
      'Add 3 <div> to parent 2',
    ]);
    applyOperationsV2(store, event);

    const spy = sinon.spy();
    effect(() => spy(store.nodeList.value));
    spy.resetHistory();

    // prettier-ignore
    const event2 = fromSnapshot([
      'rootId: 1',
      'Remove 2',
      'Remove 3',
    ]);
    applyOperationsV2(store, event2);

    expect(spy.callCount).to.eq(2); // TODO: Should be called once
    expect(store.nodes.value.get(1)!.children).to.deep.equal([]);
    expect(store.nodes.value.get(2)).to.equal(undefined);
    expect(store.nodes.value.get(3)).to.equal(undefined);
  });

  it('should reset inspectData on clear()', () => {
    const store = createStore();
    store.inspectData.value = {
      canSuspend: false,
      context: null,
      hooks: null,
      id: 123,
      key: null,
      name: 'Foo',
      props: null,
      state: null,
      signals: null,
      suspended: false,
      type: 1,
      version: '',
      __source: {
        fileName: 'foo.tsx',
        lineNumber: 12,
        columnNumber: 10,
      },
    };
    store.clear();
    expect(store.inspectData.value).to.equal(null);
  });
});
