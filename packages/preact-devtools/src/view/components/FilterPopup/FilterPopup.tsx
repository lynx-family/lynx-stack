import { h } from 'preact';
import { ComponentChildren } from 'preact';
import { Icon } from '../icons';
import s from './FilterPopup.module.css';

export function FilterCheck({
  checked,
  label,
  onInput,
}: {
  checked: boolean;
  onInput: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label class={s.filterRow}>
      <span class={s.filterCheck}>
        <input
          type='checkbox'
          checked={checked}
          onInput={e => onInput((e.target as any).checked)}
        />
        <Icon icon={checked ? 'checkbox-checked' : 'checkbox-unchecked'} />
      </span>
      <span class={`${s.filterValue} ${s.filterValueText}`}>{label}</span>
    </label>
  );
}

export function FilterNumber({
  value,
  label,
  onInput,
  units,
  defaultValue,
}: {
  value: number | false;
  onInput: (value: number | false) => void;
  label: string;
  units?: string;
  defaultValue: number;
}) {
  const checked = value !== false;
  return (
    <label class={s.filterRow}>
      <span class={s.filterCheck}>
        <input
          type='checkbox'
          checked={checked}
          onInput={e =>
            onInput(
              (e.target as any).checked ? defaultValue : (false as const),
            )}
        />
        <Icon icon={checked ? 'checkbox-checked' : 'checkbox-unchecked'} />
      </span>
      <span class={`${s.filterValue} ${s.filterValueText}`}>
        {label}{' '}
        <input
          type='number'
          class={s.filterInputNumber}
          value={checked ? value : defaultValue}
          onInput={e => {
            onInput((e.target as any).value);
          }}
        >
        </input>{' '}
        {units}
      </span>
    </label>
  );
}

export function FilterPopup({
  children,
  onFiltersSubmit,
  filterActions,
  className,
}: {
  children: ComponentChildren;
  filterActions?: ComponentChildren;
  onFiltersSubmit: () => void;
  className?: string;
}) {
  return (
    <div class={`${s.filter} ${className}`} data-testid='filter-popup'>
      <form
        onSubmit={e => {
          e.preventDefault();
          onFiltersSubmit();
        }}
      >
        {children}
        <div class={s.vSep} />
        <div class={s.filterActions}>
          {filterActions}
          <button
            type='submit'
            class={s.filterSubmitBtn}
            data-testid='filter-update'
          >
            Update
          </button>
        </div>
      </form>
    </div>
  );
}
