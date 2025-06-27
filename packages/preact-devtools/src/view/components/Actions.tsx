import { h, ComponentChildren } from 'preact';

export interface Props {
  class?: string;
  children?: ComponentChildren;
}

export function Actions(props: Props) {
  return (
    <div class={`actions ${props.class || ''}`} data-testid='actions'>
      {props.children}
    </div>
  );
}

export function ActionSeparator() {
  return <div class='actions-sep' />;
}
