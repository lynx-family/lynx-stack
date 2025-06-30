import { h, RefObject } from 'preact';
import { useMemo } from 'preact/hooks';
import { placeRanked } from './ranked-utils';
import { CommitData } from '../../data/commits';
import { ID, DevNode } from '../../../../store/types';
import { FlameNode } from '../FlameNode';
import { formatTime } from '../../util';
import { useStore } from '../../../../store/react-bindings';
import { HocLabels } from '../../../elements/TreeView';
import { useVirtualizedList } from '../../../elements/VirtualizedList';
import { NodeTransform } from '../shared';

export interface RankedLayoutProps {
  commit: CommitData;
  selected: DevNode;
  containerRef: RefObject<HTMLDivElement>;
  canvasWidth: number;
  onSelect: (id: ID) => void;
  onMouseEnter: (id: ID) => void;
  onMouseLeave: () => void;
}

/**
 * Layout nodes in a flat list from top to bottom
 * in descending order by the time it took a node
 * to render.
 */
export function RankedLayout({
  canvasWidth,
  containerRef,
  commit,
  selected,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: RankedLayoutProps) {
  // Convert node tree to position data
  const store = useStore();
  const data = store.profiler.rankedNodes.value;
  const filterHoc = store.filter.filterHoc.value;

  const placed = useMemo(
    () => placeRanked(commit.selfDurations, data, selected, canvasWidth),
    [canvasWidth, selected, commit, data],
  );

  const { children: rowItems, containerHeight } = useVirtualizedList<
    NodeTransform
  >({
    minBufferCount: 5,
    container: containerRef,
    items: placed,
    rowHeight: 21,
    // eslint-disable-next-line react/display-name
    renderRow: (pos, _, top) => {
      const node = commit.nodes.get(pos.id)!;
      const selfDuration = commit.selfDurations.get(node.id) || 0;
      const hocs = filterHoc && node.hocs
        ? <HocLabels hocs={node.hocs} nodeId={node.id} canMark={false} />
        : (
          ''
        );
      return (
        <div key={pos.id} style={`top: ${top}px; position: absolute; left: 0;`}>
          <FlameNode
            node={pos}
            selected={pos.id === selected.id}
            parentId={selected.parent}
            onClick={onSelect}
            name={node.name}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            <span data-testid='node-name'>{node.name}</span>
            {hocs} ({formatTime(selfDuration)})
          </FlameNode>
        </div>
      );
    },
  });

  return (
    <div class='flamegraph-pane' style={`height: ${containerHeight}px;`}>
      {rowItems}
    </div>
  );
}
