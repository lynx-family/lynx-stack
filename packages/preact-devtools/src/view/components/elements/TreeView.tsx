import { h } from 'preact';
import { useStore } from '../../store/react-bindings';
import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import { getLastChild } from '../tree/windowing';
import { useKeyListNav } from '../tree/keyboard';
import { useSelection } from '../../store/selection';
import { useCollapser } from '../../store/collapser';
import { BackgroundLogo } from './background-logo';
import { useSearch } from '../../store/search';
import { useResize } from '../utils';
import { ID } from '../../store/types';
import { debounce } from '../../../shells/shared/utils';
import { EmitFn } from '../../../adapter/hook';
import { useVirtualizedList } from './VirtualizedList';
import { useAutoIndent } from './useAutoIndent';
import { Hoc } from '../sidebar/HocPanel';

const ROW_HEIGHT = 18;

const highlightNode = debounce(
  (notify: EmitFn, id: ID | null) => notify('highlight', id),
  100,
);

export function TreeView() {
  const store = useStore();
  const nodeList = store.nodeList.value;
  const roots = store.roots.value;
  const { collapseNode, collapsed } = useCollapser();
  const { selected, selectNext, selectPrev } = useSelection();

  const onKeyDown = useKeyListNav({
    selected,
    onCollapse: collapseNode,
    canCollapse: id => {
      const node = store.nodes.value.get(id);
      return node ? node.children.length > 0 : false;
    },
    checkCollapsed: id => collapsed.has(id),
    onNext: () => {
      selectNext();
      const s = store.selection.selected.value;
      highlightNode(store.notify, s);
      store.notify('inspect', s);
    },
    onPrev: () => {
      selectPrev();
      const s = store.selection.selected.value;
      highlightNode(store.notify, s);
      store.notify('inspect', s);
    },
  });

  const onMouseLeave = useCallback(() => highlightNode(store.notify, null), []);
  const ref = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);

  const search = useSearch();

  const [updateCount, setUpdateCount] = useState(0);
  useResize(() => setUpdateCount(updateCount + 1), [updateCount]);

  const {
    children: listItems,
    containerHeight,
    scrollToItem,
  } = useVirtualizedList<ID>({
    rowHeight: ROW_HEIGHT,
    minBufferCount: 5,
    container: ref,
    items: nodeList,
    // eslint-disable-next-line react/display-name
    renderRow: (id, _, top) => <TreeItem key={id} id={id} top={top} />,
  });

  // Scroll to item on selection change
  useEffect(() => {
    scrollToItem(selected);
  }, [selected, scrollToItem]);

  // Scroll to item on search value change
  const searchSelectedId = search.selectedId;
  useEffect(() => {
    scrollToItem(searchSelectedId);
  }, [searchSelectedId, scrollToItem]);

  useAutoIndent(paneRef, [listItems]);

  // When the devtools is connected, but nothing has been sent to the panel yet
  const isOnlyConnected = nodeList.length === 0 && roots.length === 0;
  // When client sent messages, but no nodes were sent due to filters.
  const hasNoResults = nodeList.length === 0 && roots.length > 0;

  return (
    <div
      ref={ref}
      tabIndex={0}
      class='tree-view'
      onKeyDown={onKeyDown}
      data-tree={true}
      onMouseLeave={onMouseLeave}
    >
      {isOnlyConnected && (
        <div class='tree-view-empty' data-testid='msg-only-connected'>
          <div class='tree-view-empty-inner'>
            <BackgroundLogo class='tree-view-empty-logo' />
            <p>
              <b>Connected</b>, listening for Preact operations...
            </p>
            <p class='tree-view-empty-descr'>
              <small>
                If this message doesn&apos;t go away, your ReactLynx App is not
                setup with devtools. You can fix this by adding the{' '}
                <code>import &apos;@lynx-js/preact-devtools&apos;</code>{' '}
                import at the <b>top</b> of your entry file.
              </small>
            </p>
          </div>
        </div>
      )}
      {hasNoResults && (
        <div class='tree-view-empty' data-testid='msg-no-results'>
          <div class='tree-view-empty-inner'>
            <BackgroundLogo class='tree-view-empty-logo' />
            <p>
              <b>Nothing to show</b>
            </p>
            <p class='tree-view-empty-descr'>
              <small>
                No nodes visible with active filters. To fix this update filters
                or make sure to render at least one component in your app.
              </small>
            </p>
          </div>
        </div>
      )}
      <div
        class='tree-view-pane'
        ref={paneRef}
        data-testid='elements-tree'
        style={`height: ${containerHeight}px`}
      >
        {listItems}
        <HighlightPane treeDom={ref.current} />
      </div>
    </div>
  );
}

export function MarkResult(props: { text: string; id: ID }) {
  const { regex, selectedId } = useSearch();
  const { text, id } = props;
  const isActive = id === selectedId;

  if (regex != null && regex.test(text)) {
    const m = text.match(regex)!;
    const idx = m.index || 0;
    const start = idx > 0 ? text.slice(0, idx) : '';
    const end = idx < text.length ? text.slice(idx + m[0].length) : '';
    return (
      <span data-testid='node-name'>
        {start}
        <mark class='mark' data-marked={isActive}>
          {m[0]}
        </mark>
        {end}
      </span>
    );
  }
  return <span data-testid='node-name'>{text}</span>;
}

export function TreeItem(props: { key: any; id: ID; top: number }) {
  const { id } = props;
  const store = useStore();
  const as = useSelection();
  const { collapsed, toggle } = useCollapser();
  const node = store.nodes.value.get(id) || null;
  const filterRoot = store.filter.filterRoot.value;
  const filterHoc = store.filter.filterHoc.value;
  const roots = store.roots.value;
  const onToggle = () => toggle(id);
  const ref = useRef<HTMLDivElement>(null);

  if (!node) return null;

  const isRoot = node.parent === -1 && roots.includes(node.id);

  return (
    <div
      ref={ref}
      class='tree-view-item'
      data-testid='tree-item'
      data-name={node.name}
      onClick={() => {
        as.selectById(id);
        store.notify('inspect', id);
      }}
      onMouseEnter={() => highlightNode(store.notify, id)}
      data-selected={as.selected === id}
      data-id={id}
      data-depth={node.depth}
      style={`top: ${props.top}px;`}
    >
      <div
        class='tree-view-item-header'
        style={`transform: translate3d(calc(var(--indent-depth) * ${
          node.depth + (filterRoot ? -1 : 0)
        }), 0, 0);`}
      >
        {node.children.length > 0 && (
          <button
            class='tree-view-collapse'
            data-collapsed={collapsed.has(id)}
            onClick={onToggle}
          >
            <Arrow />
          </button>
        )}
        {node.children.length === 0 && <div class='tree-view-no-collapse' />}
        <span class='tree-view-name'>
          <MarkResult text={node.name} id={id} />
          {node.key
            ? (
              <span class='tree-view-key-label'>
                {' '}
                key=&quot;
                <span class='tree-view-key'>
                  {node.key.length > 15
                    ? `${node.key.slice(0, 15)}…`
                    : node.key}
                </span>
                &quot;
              </span>
            )
            : (
              ''
            )}
          {filterHoc && node.hocs && node.hocs.length > 0 && (
            <HocLabels hocs={node.hocs} nodeId={id} />
          )}
          {isRoot ? <span class='tree-view-root-label'>(Root)</span> : ''}
        </span>
      </div>
    </div>
  );
}

export function HocLabels({
  hocs,
  nodeId,
  canMark = true,
}: {
  hocs: string[];
  nodeId: number;
  canMark?: boolean;
}) {
  return (
    <span class='hocs' data-testid='hoc-labels'>
      {hocs.map((hoc, i) => {
        return (
          <Hoc key={i} small>
            {canMark ? <MarkResult text={hoc} id={nodeId} /> : hoc}
          </Hoc>
        );
      })}
    </span>
  );
}

export function Arrow() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 4.233 4.233'
    >
      <path d='M1.124 1.627H3.11l-.992 1.191-.993-1.19' fill='currentColor' />
    </svg>
  );
}

export function HighlightPane(props: { treeDom: HTMLDivElement | null }) {
  const store = useStore();
  const nodes = store.nodes.value;
  const { selected } = useSelection();
  const { collapsed } = useCollapser();

  // Subscribe to nodeList so that we rerender whenever nodes
  // are collapsed
  const list = store.nodeList.value;

  const [pos, setPos] = useState({ top: 0, height: 0 });
  useEffect(() => {
    if (selected > -1 && !collapsed.has(selected)) {
      if (props.treeDom != null) {
        const start = props.treeDom.querySelector(
          `[data-id="${selected}"`,
        ) as HTMLDivElement | null;
        const lastId = getLastChild(nodes, selected);
        const last = props.treeDom.querySelector(
          `[data-id="${lastId}"]`,
        ) as HTMLDivElement | null;

        if (start != null && last != null) {
          const rect = start.getBoundingClientRect();
          const top = start.offsetTop + rect.height;
          const lastRect = last.getBoundingClientRect();
          const height = last.offsetTop + lastRect.height - top;
          setPos({ top, height });
        } else {
          setPos({ top: 0, height: 0 });
        }
      } else {
        setPos({ top: 0, height: 0 });
      }
    } else {
      setPos({ top: 0, height: 0 });
    }
  }, [selected, list]);

  return (
    <div
      class='tree-view-dimmer'
      style={`top: ${pos.top}px; height: ${pos.height}px;`}
    />
  );
}
