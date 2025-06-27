import { h } from 'preact';
import { render } from '@testing-library/preact';
import { TreeItem } from './TreeView';
import { expect } from 'chai';
import { AppCtx } from '../../store/react-bindings';
import { createStore } from '../../store';
import { DevNodeType } from '../../store/types';

describe('TreeItem', () => {
  it('should limit key length to 15', () => {
    const store = createStore();
    store.nodes.value.set(1, {
      children: [],
      depth: 1,
      endTime: 0,
      key: 'abcdefghijklmnopqrstuvxyz',
      id: 1,
      hocs: null,
      name: 'foo',
      owner: -1,
      parent: -1,
      startTime: 0,
      type: DevNodeType.ClassComponent,
    });
    const { container, rerender } = render(
      <AppCtx.Provider value={store}>
        <TreeItem id={1} key='' top={0} />,
      </AppCtx.Provider>,
    );
    expect(container.textContent).to.equal('foo key="abcdefghijklmno…",');

    store.nodes.value.get(1)!.key = 'foobar';
    store.nodes.value = new Map(store.nodes.value);
    rerender(
      <AppCtx.Provider value={store}>
        <TreeItem id={1} key='' top={0} />,
      </AppCtx.Provider>,
    );

    expect(container.textContent).to.equal('foo key="foobar",');
  });
});
