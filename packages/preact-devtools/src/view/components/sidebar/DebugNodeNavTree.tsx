import { h } from 'preact';
import { useStore } from '../../store/react-bindings';
import { SidebarPanel, Empty } from './SidebarPanel';

export function DebugNodeNavTree() {
  const store = useStore();
  const selected = store.selection.selected.value;
  const nodes = store.nodeList.value.map(id => store.nodes.value.get(id)!);

  return (
    <SidebarPanel title='Debug Node Navigation:' testId='profiler-debug-nav'>
      {nodes.length === 0
        ? <Empty>No nodes found inside commit</Empty>
        : (
          <nav data-testid='debug-nav'>
            {nodes.map((node, i) => {
              return (
                <button
                  key={node.id}
                  class='rendered-at-item'
                  data-active={selected === node.id}
                  onClick={() => (store.profiler.selectedNodeId.value =
                    node.id)}
                >
                  <span style='display: flex; justify-content: space-between; width: 100%'>
                    <span>
                      {node.name}
                      {i === 0 ? <b>(R)</b> : null}
                    </span>
                    <span>{node.id}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        )}
    </SidebarPanel>
  );
}
