import { expect } from 'chai';
import { flames } from './testHelpers';
import { DevNodeType, DevNode } from '../../../store/types';

describe('FlameGraph DSL', () => {
  it('should convert flat flamegraph', () => {
    const tree = flames`
      App *********
       Foo ******
         Bar ***
    `;

    const expected: DevNode[] = [
      {
        id: 1,
        name: 'App',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 0,
        endTime: 130,
        children: [2],
        hocs: null,
        parent: -1,
        owner: -1,
        depth: 0,
      },
      {
        id: 2,
        name: 'Foo',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 10,
        endTime: 110,
        children: [3],
        hocs: null,
        parent: 1,
        owner: -1,
        depth: 1,
      },
      {
        id: 3,
        name: 'Bar',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 30,
        endTime: 100,
        depth: 2,
        children: [],
        hocs: null,
        owner: -1,
        parent: 2,
      },
    ];

    expect(tree.nodes).to.deep.equal(expected);
  });

  it('should detect flat children', () => {
    const tree = flames`
      App *********
      Foo ******
      Bar ***
    `;

    const expected: DevNode[] = [
      {
        id: 1,
        name: 'App',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 0,
        endTime: 130,
        children: [2],
        hocs: null,
        parent: -1,
        owner: -1,
        depth: 0,
      },
      {
        id: 2,
        name: 'Foo',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 0,
        endTime: 100,
        children: [3],
        hocs: null,
        parent: 1,
        owner: -1,
        depth: 1,
      },
      {
        id: 3,
        name: 'Bar',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 0,
        endTime: 70,
        parent: 2,
        owner: -1,
        depth: 2,
        children: [],
        hocs: null,
      },
    ];

    expect(tree.nodes).to.deep.equal(expected);
  });

  it('should throw if names are not unique', () => {
    expect(
      () =>
        flames`
      App ***
      App ***
    `,
    ).to.throw();
  });

  it('should access nodes by name', () => {
    const tree = flames`
      App *********
      Foo ******
      Bar ***
    `;

    expect(tree.byName('App')).to.not.be.undefined;
    expect(tree.byName('Foo')).to.not.be.undefined;
    expect(tree.byName('Bar')).to.not.be.undefined;
  });

  it('should search for parent on offset nodes', () => {
    const tree = flames`
			Parent ***
			            Child ******
		`;

    expect(tree.byName('Child')!.parent).to.equal(1);
    expect(tree.byName('Parent')!.children).to.deep.equal([2]);
  });

  it('should search for parent on offset nodes #2', () => {
    const tree = flames`
			              Parent ***
			Child ******
		`;

    expect(tree.byName('Child')!.parent).to.equal(1);
    expect(tree.byName('Parent')!.children).to.deep.equal([2]);
  });

  it('should support simple sibling children', () => {
    const tree = flames`
    App ******************
     Foo ******  Bar ***
  `;

    const expected: DevNode[] = [
      {
        id: 1,
        name: 'App',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 0,
        endTime: 220,
        children: [2, 3],
        hocs: null,
        parent: -1,
        owner: -1,
        depth: 0,
      },
      {
        id: 2,
        name: 'Foo',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 10,
        endTime: 110,
        children: [],
        hocs: null,
        parent: 1,
        owner: -1,
        depth: 1,
      },
      {
        id: 3,
        name: 'Bar',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 130,
        endTime: 200,
        depth: 1,
        children: [],
        hocs: null,
        parent: 1,
        owner: -1,
      },
    ];

    expect(tree.nodes).to.deep.equal(expected);
  });

  it('should not mix unrelated children', () => {
    const tree = flames`
    App ******************
     Foo ******  Baz ***
       Bar ***    Bob **
	`;

    const expected: DevNode[] = [
      {
        id: 1,
        name: 'App',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 0,
        endTime: 220,
        children: [2, 4],
        hocs: null,
        depth: 0,
        parent: -1,
        owner: -1,
      },
      {
        id: 2,
        name: 'Foo',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 10,
        endTime: 110,
        children: [3],
        hocs: null,
        parent: 1,
        owner: -1,
        depth: 1,
      },
      {
        id: 3,
        name: 'Bar',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 30,
        endTime: 100,
        depth: 2,
        children: [],
        hocs: null,
        parent: 2,
        owner: -1,
      },
      {
        id: 4,
        name: 'Baz',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 130,
        endTime: 200,
        depth: 1,
        children: [5],
        hocs: null,
        parent: 1,
        owner: -1,
      },
      {
        id: 5,
        name: 'Bob',
        key: '',
        type: DevNodeType.FunctionComponent,
        startTime: 140,
        endTime: 200,
        depth: 2,
        children: [],
        hocs: null,
        parent: 4,
        owner: -1,
      },
    ];

    expect(tree.nodes).to.deep.equal(expected);
  });

  it('should create a commit', () => {
    const tree = flames`
			App *******
			  Bar **
		`;

    expect(tree.commit).to.deep.equal({
      commitRootId: 1,
      rootId: 1,
      duration: 110,
      rendered: new Set(tree.commit.nodes.keys()),
      maxSelfDuration: 60,
      nodes: tree.idMap,
      selfDurations: tree.commit.selfDurations,
    });
  });
});
