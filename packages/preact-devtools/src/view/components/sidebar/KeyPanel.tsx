import { h } from 'preact';
import { SidebarPanel } from './SidebarPanel';

export interface Props {
  onCopy: () => void;
  value: string;
}

export function KeyPanel(props: Props) {
  return (
    <SidebarPanel title='Key' testId='key-panel' onCopy={props.onCopy}>
      <span class='keypanel-value' data-testid='vnode-key'>
        {props.value}
      </span>
    </SidebarPanel>
  );
}
