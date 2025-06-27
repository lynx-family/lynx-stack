import { useComputed } from '@preact/signals';
import { h } from 'preact';
import { useStore } from '../../store/react-bindings';
import { DevNode } from '../../store/types';
import { SidebarPanel } from '../sidebar/SidebarPanel';
import { ClickToComponent } from '../sidebar/ClickToComponent';

export function OwnerInfo() {
  const store = useStore();

  const selectedId = store.selection.selected.value;
  const data = useComputed(() => {
    const owners: DevNode[] = [];
    const selectedId = store.selection.selected.value;

    const nodes = store.nodes.value;

    let id = selectedId;
    let current: DevNode | undefined;
    while ((current = nodes.get(id)) !== undefined) {
      if (!nodes.has(current.owner)) {
        break;
      }
      owners.push(nodes.get(current.owner)!);
      id = current.owner;
    }

    return owners;
  }).value;

  if (selectedId === -1) {
    return null;
  }

  return (
    <SidebarPanel title='Rendered by'>
      <div class='rendered-by-wrapper'>
        <nav data-testid='owners'>
          {data.map(node => {
            return (
              <button
                key={node.id}
                class='rendered-at-item'
                data-active={selectedId === node.id}
                onClick={() => {
                  store.selection.selectById(node.id);
                }}
              >
                {node.name}
              </button>
            );
          })}
        </nav>
        <p class='sidebar-preact-version'>
          Preact@{store.inspectData.value?.version || ''}
        </p>
        <ClickToComponent source={store.inspectData.value?.__source} />
      </div>
    </SidebarPanel>
  );
}
