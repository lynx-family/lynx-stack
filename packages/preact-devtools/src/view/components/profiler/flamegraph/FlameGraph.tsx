import { Fragment, h } from 'preact';
import { useStore } from '../../../store/react-bindings';
import { useRef, useCallback, useState, useEffect } from 'preact/hooks';
import { FlamegraphType } from '../data/commits';
import { useResize } from '../../utils';
import { RankedLayout } from './ranked/RankedLayout';
import { FlamegraphLayout } from './modes/FlamegraphLayout';
import { EMPTY } from './placeNodes';
import { debounce } from '../../../../shells/shared/utils';
import { EmitFn } from '../../../../adapter/hook';
import { ID } from '../../../store/types';

const highlightNode = debounce(
  (notify: EmitFn, id: ID | null) => notify('highlight', id),
  100,
);

export function FlameGraph() {
  const store = useStore();
  const [canvasWidth, setCanvasWidth] = useState(-1);

  const displayType = store.profiler.flamegraphType.value;
  const selected = store.profiler.selectedNode.value || EMPTY;
  const commit = store.profiler.activeCommit.value;
  const isRecording = store.profiler.isRecording.value;
  const showDebug = store.debugMode.value;

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      // Pad for potential rounding issues
      setCanvasWidth(Math.floor(ref.current.clientWidth) - 4);
    }
  }, [isRecording, commit]);
  useResize(
    () => {
      if (ref.current) {
        // Pad for potential rounding issues
        setCanvasWidth(Math.floor(ref.current.clientWidth) - 4);
      }
    },
    [commit],
    true,
  );

  const onSelect = useCallback(
    (id: number) => {
      store.profiler.selectedNodeId.value = id;
      store.selection.selectById(id);
    },
    [store],
  );

  const onMouseEnter = useCallback((id: ID) => {
    highlightNode(store.notify, id);
  }, []);

  const onMouseLeave = useCallback(() => {
    highlightNode(store.notify, null);
  }, []);

  if (isRecording || !commit) return null;

  return (
    <div
      class='flamegraph'
      ref={ref}
      data-type={displayType.toLowerCase()}
      style={showDebug ? 'overflow-x: auto' : ''}
    >
      {canvasWidth === -1 ? null : (
        <Fragment>
          {displayType === FlamegraphType.RANKED
            ? (
              <RankedLayout
                canvasWidth={canvasWidth}
                containerRef={ref}
                commit={commit!}
                onSelect={onSelect}
                selected={selected}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            )
            : (
              <FlamegraphLayout
                canvasWidth={canvasWidth}
                containerRef={ref}
                commit={commit!}
                onSelect={onSelect}
                selected={selected}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            )}
        </Fragment>
      )}
    </div>
  );
}
