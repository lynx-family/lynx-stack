import { h } from 'preact';
import { Icon } from '../icons';

export interface CheckboxProps {
  testId?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: any;
}

export function Checkbox(props: CheckboxProps) {
  return (
    <label class='checkbox-root'>
      <span class='checkbox-wrapper'>
        <input
          type='checkbox'
          checked={props.checked}
          data-testid={props.testId}
          onInput={e => props.onChange((e.target as any).checked)}
        />
        <Icon
          icon={props.checked ? 'checkbox-checked' : 'checkbox-unchecked'}
        />
      </span>
      <span class='checkbox-content'>{props.children}</span>
    </label>
  );
}
