import { useComputed } from '@preact/signals';
import { Fragment, h } from 'preact';
import { useStore } from '../../../../store/react-bindings';
import { SidebarPanel, Empty } from '../../../sidebar/SidebarPanel';
import { formatTime } from '../../util';

export function RenderedAt() {
  const store = useStore();
  const commit = store.profiler.activeCommit.value;
  const selected = store.profiler.selectedNodeId.value;
  const data = useComputed(() => {
    const id = store.profiler.selectedNodeId.value;

    return store.profiler.commits.value.reduce<
      Array<{ index: number; selfDuration: number }>
    >((acc, commit, i) => {
      if (!commit.rendered.has(id)) return acc;

      const selfDuration = commit.selfDurations.get(id) || 0;
      acc.push({
        index: i,
        selfDuration,
      });
      return acc;
    }, []);
  }).value;

  const commitIdx = store.profiler.activeCommitIdx.value;

  if (commit === null) return null;

  const commitRoot = commit.nodes.get(commit.commitRootId)!;

  return (
    <Fragment>
      {data.length > 0 && (
        <Fragment>
          <SidebarPanel title='Commit Root:'>
            <nav data-testid='commitRoot' class='sidebar-nav-panel-content'>
              <button
                class='rendered-at-item'
                data-active={selected === commit.commitRootId}
                onClick={() => (store.profiler.selectedNodeId.value =
                  commit.commitRootId)}
              >
                <span>{commitRoot.name}</span>
              </button>
            </nav>
          </SidebarPanel>
          <SidebarPanel title='Rendered at:'>
            {data.length <= 0
              ? <Empty>Did not render during this profiling session</Empty>
              : (
                <nav
                  data-testid='rendered-at'
                  class='sidebar-nav-panel-content'
                >
                  {data.map(node => {
                    return (
                      <button
                        key={node.index}
                        class='rendered-at-item'
                        data-active={commitIdx === node.index}
                        onClick={() => {
                          store.profiler.activeCommitIdx.value = node.index;
                          store.profiler.filterCommitsUnder.value = false;
                        }}
                      >
                        <span>
                          Commit #{node.index} for{' '}
                          {formatTime(node.selfDuration)}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              )}
          </SidebarPanel>
        </Fragment>
      )}
    </Fragment>
  );
}
