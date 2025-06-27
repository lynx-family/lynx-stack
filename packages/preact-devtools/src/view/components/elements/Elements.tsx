import { h } from 'preact';
import { TreeBar } from './TreeBar';
import { TreeView } from './TreeView';
import { SidebarActions } from '../sidebar/SidebarActions';
import { Sidebar } from '../sidebar/Sidebar';
import s from '../Devtools.module.css';
import { SidebarLayout } from '../SidebarLayout';

export function Elements() {
  return (
    <SidebarLayout>
      <div class={s.componentActions}>
        <TreeBar />
      </div>
      <div class={s.components}>
        <TreeView />
      </div>
      <div class={s.sidebarActions}>
        <SidebarActions />
      </div>
      <div class={s.sidebar}>
        <Sidebar />
      </div>
    </SidebarLayout>
  );
}
