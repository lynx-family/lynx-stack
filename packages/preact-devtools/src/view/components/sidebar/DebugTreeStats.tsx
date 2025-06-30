import { h } from 'preact';
import { useStore } from '../../store/react-bindings';
import { SidebarPanel } from './SidebarPanel';
export function DebugTreeStats() {
  const store = useStore();
  const nodeList = store.nodeList.value;

  return (
    <SidebarPanel title='Debug Tree Stats' testId='tree-debug-stats'>
      <div style='padding-left: 0.35rem'>
        <dl>
          <dt>Active displayed node count</dt>
          <dd>{nodeList.length}</dd>
          <dt>Selected node index</dt>
          <dd>{store.selection.selectedIdx.value}</dd>
        </dl>
      </div>
    </SidebarPanel>
  );
}
