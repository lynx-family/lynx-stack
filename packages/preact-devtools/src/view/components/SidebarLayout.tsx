import { h } from 'preact';

export interface ChildProps {
  children: any;
}

export function SidebarLayout(props: ChildProps) {
  return <div class='sidebar-layout'>{props.children}</div>;
}

export function SingleLayout(props: ChildProps) {
  return <div class='sidebar-layout-single'>{props.children}</div>;
}

export function PageLayout(props: ChildProps) {
  return (
    <div class='sidebar-layout-root'>
      <div class='sidebar-layout-inner'>{props.children}</div>
    </div>
  );
}
