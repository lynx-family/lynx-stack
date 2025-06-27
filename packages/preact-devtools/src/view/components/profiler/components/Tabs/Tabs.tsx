import { h, ComponentChild } from 'preact';
import { useCallback } from 'preact/hooks';

export interface TabProps {
  children: ComponentChild;
  value: string;
  name: string;
  checked: boolean;
  onClick: (v: string) => void;
}

export function SmallTab(props: TabProps) {
  const onClick = useCallback(() => {
    props.onClick(props.value);
  }, [props]);

  return (
    <label class='tab'>
      <input
        class='tab-input'
        type='radio'
        name={props.name}
        value={props.value}
        checked={props.checked}
        onClick={onClick}
      />
      <span class='tab-title'>{props.children}</span>
    </label>
  );
}

export function SmallTabGroup(props: {
  children: ComponentChild;
  class?: string;
}) {
  return <div class={`tab-group ${props.class || ''}`}>{props.children}</div>;
}

export interface IconTabProps extends TabProps {
  icon: ComponentChild;
  disabled?: boolean;
}

export function IconTab(props: IconTabProps) {
  const onClick = useCallback(() => {
    props.onClick(props.value);
  }, [props]);

  return (
    <label class='tab-icon-wrapper'>
      <input
        class='tab-input'
        type='radio'
        name={props.name}
        value={props.value}
        checked={props.checked}
        onClick={onClick}
        disabled={props.disabled}
      />
      <span class='tab-icon-inner'>
        {props.icon}
        <span class='tab-icon-label'>{props.children}</span>
      </span>
    </label>
  );
}
