import { h, RefObject } from 'preact';
import { CommitData } from '../../data/commits';
import { ID, DevNode } from '../../../../store/types';
import { FlameNode } from '../FlameNode';
import { useEffect, useMemo } from 'preact/hooks';
import { placeFlamegraph } from './flamegraph-utils';
import { formatTime } from '../../util';
import { useStore } from '../../../../store/react-bindings';
import { HocLabels } from '../../../elements/TreeView';
import { NodeTransform } from '../shared';
import { useVirtualizedList } from '../../../elements/VirtualizedList';

export interface FlamegraphLayoutProps {
  commit: CommitData;
  selected: DevNode;
  canvasWidth: number;
  containerRef: RefObject<HTMLDivElement>;
  onSelect: (id: ID) => void;
  onMouseEnter: (id: ID) => void;
  onMouseLeave: () => void;
}

export function FlamegraphLayout({
  commit,
  selected,
  canvasWidth,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  containerRef,
}: FlamegraphLayoutProps) {
  const store = useStore();
  const data = store.profiler.flamegraphNodes.value;
  const filterHoc = store.filter.filterHoc.value;

  const placed = useMemo(
    () =>
      placeFlamegraph(
        commit.nodes,
        data,
        commit.rootId,
        selected.id,
        canvasWidth,
      ),
    [commit, data, selected, canvasWidth],
  );

  const {
    children: rowItems,
    containerHeight,
    scrollToItem,
  } = useVirtualizedList<NodeTransform[]>({
    minBufferCount: 5,
    container: containerRef,
    items: placed,
    rowHeight: 21,
    // eslint-disable-next-line react/display-name
    renderRow: (row, _, top) => {
      return (
        <div style={`top: ${top}px; position: absolute; left: 0;`}>
          {row.map(item => (
            <FlameGraphNode
              commit={commit}
              filterHoc={filterHoc}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onSelect={onSelect}
              pos={item}
              selected={selected}
              key={item.id}
            />
          ))}
        </div>
      );
    },
  });

  // Scroll to item on selection change
  useEffect(() => {
    const pos = data.get(selected.id);
    if (!pos) return;
    scrollToItem(placed[pos.row]);
  }, [selected, scrollToItem]);

  return (
    <div class='flamegraph-pane' style={`height: ${containerHeight}px;`}>
      {rowItems}
    </div>
  );
}

function FlameGraphNode({
  commit,
  pos,
  onMouseEnter,
  onMouseLeave,
  selected,
  onSelect,
  filterHoc,
}: {
  commit: CommitData;
  pos: NodeTransform;
  onMouseEnter: (id: number) => void;
  onMouseLeave: () => void;
  selected: DevNode;
  onSelect: (id: number) => void;
  filterHoc: boolean;
}) {
  const node = commit.nodes.get(pos.id)!;
  let appendix = '';
  if (!pos.commitParent && pos.weight !== -1) {
    const self = formatTime(commit.selfDurations.get(pos.id) || 0);
    const total = formatTime(node.endTime - node.startTime);
    appendix = ` (${self} of ${total})`;
  }

  return (
    <FlameNode
      key={pos.id}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      node={pos}
      name={node.name}
      selected={pos.id === selected.id}
      parentId={commit.nodes.get(pos.id)!.parent}
      onClick={onSelect}
    >
      {node.name}
      {filterHoc && node.hocs
        ? <HocLabels hocs={node.hocs} nodeId={node.id} canMark={false} />
        : null}
      {appendix}
    </FlameNode>
  );
}
