import { h, render, Options, options, Fragment, Component } from 'preact';
import * as sinon from 'sinon';
import { createRenderer } from './renderer';
import { setupOptionsV10 } from '../10/options';
import { expect } from 'chai';
import { toSnapshot } from '../debug';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { bindingsV10 } from '../10/bindings';
import { FilterState } from '../adapter/filter';
import { Renderer } from '../renderer';
import { newProfiler } from '../adapter/profiler';
import { getFilteredChildren } from './traverse';
import { createIdMappingState } from './idMapper';

export function setupScratch() {
  const div = document.createElement('div');
  div.id = 'scratch';
  document.body.appendChild(div);
  return div;
}

export function setupMockHook(options: Options) {
  const spy = sinon.spy();
  const roots = new Map();
  const renderer = createRenderer(
    { send: spy, listen: () => null, listenToPage: () => null },
    { Fragment: Fragment as any },
    {},
    { hooks: false, renderReasons: false },
    newProfiler(),
    { type: new Set(), regex: [] },
    createIdMappingState(1, bindingsV10.getInstance),
    bindingsV10,
    roots,
    '',
  );
  const destroy = setupOptionsV10(options, renderer, roots, {
    Fragment: Fragment as any,
  });
  return {
    renderer,
    destroy,
    spy,
  };
}

function getOps(spy: sinon.SinonSpy) {
  return spy.args.filter(arg => arg[0] === 'operation_v2');
}

describe('Renderer 10', () => {
  let scratch: HTMLDivElement;
  let destroy: () => void;
  let spy: sinon.SinonSpy;
  let renderer: Renderer;

  beforeEach(() => {
    scratch = setupScratch();
    const mock = setupMockHook(options);
    destroy = mock.destroy;
    spy = mock.spy;
    renderer = mock.renderer;
  });

  afterEach(() => {
    scratch.remove();
    if (destroy) destroy();
  });

  it('should detect root nodes', () => {
    render(<div />, scratch);
    expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
      'rootId: 1',
      'Add 1 <Fragment> to parent -1',
      'Add 2 <div> to parent 1',
    ]);

    render(<div />, scratch);
    expect(toSnapshot(getOps(spy)[1][1])).to.deep.equal([
      'rootId: 1',
      'Update timings 1',
      'Update timings 2',
    ]);
  });

  it('should mount children', () => {
    render(
      <div>
        <span>foo</span>
        <span>bar</span>
      </div>,
      scratch,
    );
    expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
      'rootId: 1',
      'Add 1 <Fragment> to parent -1',
      'Add 2 <div> to parent 1',
      'Add 3 <span> to parent 2',
      'Add 4 <span> to parent 2',
    ]);
  });

  it('should mount after update', () => {
    render(<div>foo</div>, scratch);
    render(
      <div>
        <span />
      </div>,
      scratch,
    );

    expect(toSnapshot(getOps(spy)[1][1])).to.deep.equal([
      'rootId: 1',
      'Add 3 <span> to parent 2',
      'Update timings 1',
      'Update timings 2',
    ]);
  });

  it('should mount after filtered update', () => {
    renderer.applyFilters({
      regex: [],
      type: new Set(['dom']),
    });

    const Foo = (props: any) => <div>{props.children}</div>;
    const Bar = (props: any) => <span>{props.children}</span>;

    render(
      <div>
        <Foo />
      </div>,
      scratch,
    );
    render(
      <div>
        <Foo>
          <Bar>bar</Bar>
        </Foo>
      </div>,
      scratch,
    );

    expect(toSnapshot(getOps(spy)[1][1])).to.deep.equal([
      'rootId: 1',
      'Add 3 <Bar> to parent 2',
      'Update timings 1',
      'Update timings 2',
    ]);
  });

  it('should skip text', () => {
    render(<div>foo</div>, scratch);
    render(<div>bar</div>, scratch);

    expect(toSnapshot(getOps(spy)[1][1])).to.deep.equal([
      'rootId: 1',
      'Update timings 1',
      'Update timings 2',
    ]);
  });

  it('should reorder children', () => {
    render(
      <div>
        <p key='A'>A</p>
        <p key='B'>B</p>
      </div>,
      scratch,
    );
    render(
      <div>
        <p key='B'>B</p>
        <p key='A'>A</p>
      </div>,
      scratch,
    );

    expect(toSnapshot(getOps(spy)[1][1])).to.deep.equal([
      'rootId: 1',
      'Update timings 1',
      'Update timings 2',
      'Update timings 4',
      'Update timings 3',
      'Reorder 2 [4, 3]',
    ]);
  });

  it('should set a fallback name', () => {
    const Foo = () => <div>foo</div>;
    Object.defineProperty(Foo, 'name', {
      get: () => '',
    });

    render(<Foo />, scratch);

    expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
      'rootId: 1',
      'Add 1 <Fragment> to parent -1',
      'Add 2 <Anonymous> to parent 1',
      'Add 3 <div> to parent 2',
    ]);
  });

  describe('filters', () => {
    it('should apply regex filters', () => {
      renderer.applyFilters({
        regex: [/span/i],
        type: new Set(),
      });
      render(
        <div>
          <span>foo</span>
          <span>bar</span>
        </div>,
        scratch,
      );
      expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
        'Add 2 <div> to parent 1',
      ]);
    });

    it('should ignore case for regex', () => {
      renderer.applyFilters({
        regex: [/SpAn/i],
        type: new Set(),
      });
      render(
        <div>
          <span>foo</span>
          <span>bar</span>
        </div>,
        scratch,
      );
      expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
        'Add 2 <div> to parent 1',
      ]);
    });

    it('should filter by dom type #1', () => {
      renderer.applyFilters({
        regex: [],
        type: new Set(['dom']),
      });
      render(
        <div>
          <span>foo</span>
          <span>bar</span>
        </div>,
        scratch,
      );
      expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
      ]);
    });

    it('should filter by dom type #2', () => {
      renderer.applyFilters({
        regex: [],
        type: new Set(['dom']),
      });

      function Foo() {
        return <div>foo</div>;
      }
      render(
        <div>
          <Foo />
          <span>foo</span>
          <span>bar</span>
        </div>,
        scratch,
      );
      expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
        'Add 2 <Foo> to parent 1',
      ]);
    });

    it('should filter by fragment type', () => {
      renderer.applyFilters({
        regex: [],
        type: new Set(['fragment']),
      });

      function Foo() {
        return <div>foo</div>;
      }
      render(
        <div>
          <Foo />
          <Fragment>asdf</Fragment>
        </div>,
        scratch,
      );
      expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
        'Add 2 <div> to parent 1',
        'Add 3 <Foo> to parent 2',
        'Add 4 <div> to parent 3',
      ]);
    });

    it('should filter on update', () => {
      renderer.applyFilters({
        regex: [],
        type: new Set(['dom']),
      });

      let update: () => void;
      function Parent(props: { children: any }) {
        const [i, setI] = useState(0);
        update = () => setI(i + 1);
        return <div>{props.children}</div>;
      }

      const Foo = () => <div />;
      render(
        <Parent>
          <div>
            <Foo />
          </div>
        </Parent>,
        scratch,
      );

      expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
        'Add 2 <Parent> to parent 1',
        'Add 3 <Foo> to parent 2',
      ]);

      act(() => {
        update();
      });

      expect(toSnapshot(getOps(spy)[1][1])).to.deep.equal([
        'rootId: 2',
        'Update timings 2',
      ]);
    });

    it('should update filters after 1st render', () => {
      renderer.applyFilters({
        regex: [],
        type: new Set(['dom']),
      });

      function Foo() {
        return <div>foo</div>;
      }
      render(
        <div>
          <Foo />
          <span>foo</span>
          <span>bar</span>
        </div>,
        scratch,
      );
      expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
        'Add 2 <Foo> to parent 1',
      ]);

      renderer.applyFilters({
        regex: [],
        type: new Set(),
      });

      expect(toSnapshot(getOps(spy)[1][1])).to.deep.equal([
        'rootId: 1',
        'Remove 1',
        'Remove 2',
      ]);

      expect(toSnapshot(getOps(spy)[2][1])).to.deep.equal([
        'rootId: 3',
        'Add 4 <div> to parent 3',
        'Add 5 <Foo> to parent 4',
        'Add 6 <div> to parent 5',
        'Add 7 <span> to parent 4',
        'Add 8 <span> to parent 4',
        'Remove 3', // TODO: Seems wrong
        'Remove 3', // TODO: Seems wrong
      ]);
    });

    it('should update filters after 1st render with unmounts', () => {
      renderer.applyFilters({
        regex: [],
        type: new Set(['dom']),
      });

      function Foo(props: any) {
        return <div>{props.children}</div>;
      }
      render(
        <div>
          <Foo>
            <h1>
              <Foo>foo</Foo>
            </h1>
          </Foo>
          <span>foo</span>
          <span>bar</span>
        </div>,
        scratch,
      );
      expect(toSnapshot(getOps(spy)[0][1])).to.deep.equal([
        'rootId: 1',
        'Add 1 <Fragment> to parent -1',
        'Add 2 <Foo> to parent 1',
        'Add 3 <Foo> to parent 2',
      ]);

      renderer.applyFilters({
        regex: [],
        type: new Set(),
      });

      expect(toSnapshot(getOps(spy)[1][1])).to.deep.equal([
        'rootId: 1',
        'Remove 1',
        'Remove 2',
        'Remove 3',
      ]);
      expect(toSnapshot(getOps(spy)[2][1])).to.deep.equal([
        'rootId: 4',
        'Add 5 <div> to parent 4',
        'Add 6 <Foo> to parent 5',
        'Add 7 <div> to parent 6',
        'Add 8 <h1> to parent 7',
        'Add 9 <Foo> to parent 8',
        'Add 10 <div> to parent 9',
        'Add 11 <span> to parent 5',
        'Add 12 <span> to parent 5',
        'Update timings 2',
      ]);

      renderer.applyFilters({
        regex: [],
        type: new Set(['dom']),
      });

      expect(toSnapshot(getOps(spy)[3][1])).to.deep.equal([
        'rootId: 4',
        'Remove 4',
        'Remove 5',
        'Remove 6',
        'Remove 7',
        'Remove 8',
        'Remove 9',
        'Remove 10',
        'Remove 11',
        'Remove 12',
      ]);

      expect(toSnapshot(getOps(spy)[4][1])).to.deep.equal([
        'rootId: 13',
        'Add 13 <Fragment> to parent -1',
        'Add 14 <Foo> to parent 13',
        'Add 15 <Foo> to parent 14',
      ]);
    });
  });

  describe('getFilteredChildren', () => {
    it('should get direct children', () => {
      const Foo = () => <div>foo</div>;
      const Bar = () => <div>bar</div>;

      const vnode = (
        <div>
          <Foo />
          <Bar />
          <span />
        </div>
      );

      render(vnode, scratch);

      const filters: FilterState = {
        regex: [],
        type: new Set(['dom']),
      };

      expect(
        getFilteredChildren(
          vnode,
          filters,
          {
            Fragment: Fragment as any,
          },
          bindingsV10,
        ).map(name =>
          bindingsV10.getDisplayName(name, { Fragment: Fragment as any })
        ),
      ).to.deep.equal(['Foo', 'Bar']);
    });
  });

  describe('inspect', () => {
    it('should inspect context', () => {
      function Child() {
        return <div>child</div>;
      }

      class Parent extends Component {
        getChildContext() {
          return { foo: 123 };
        }

        render() {
          return <Child />;
        }
      }

      render(<Parent />, scratch);

      expect(renderer.inspect(3)!.context).to.deep.equal({ foo: 123 });
    });

    it('should serialize functions', () => {
      function Child() {
        return <div>child</div>;
      }

      class Parent extends Component {
        getChildContext() {
          return { foo: () => null };
        }

        render() {
          return <Child />;
        }
      }

      render(<Parent />, scratch);

      expect(renderer.inspect(3)!.context).to.deep.equal({
        foo: {
          name: 'foo',
          type: 'function',
        },
      });
    });
  });
});
