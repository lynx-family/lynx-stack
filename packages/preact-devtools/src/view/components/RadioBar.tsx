import { h } from 'preact';

export interface RadioBarProps {
  value: string;
  name: string;
  items: Array<{ label: string; value: string }>;
  onChange(v: string): void;
}

export function RadioBar(props: RadioBarProps) {
  return (
    <span class='radio-bar'>
      {props.items.map(x => {
        return (
          <label key={x.value}>
            <input
              name={props.name}
              class='radio-bar-input'
              checked={props.value === x.value}
              type='radio'
              value={x.value}
              onInput={() => props.onChange(x.value)}
            />
            <span class='radio-bar-text'>{x.label}</span>
          </label>
        );
      })}
    </span>
  );
}
