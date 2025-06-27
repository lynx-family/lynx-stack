import { h } from 'preact';
import s from './DataInput.module.css';
import { useCallback, useRef, useMemo, useState } from 'preact/hooks';
import { parseValue } from './parseValue';
import { debug } from '../../../debug';
import { Icon } from '../icons';

export interface InputProps {
  name: string;
  value: any;
  class?: string;
  placeholder?: string;
  showReset?: boolean;
  onChange: (value: any) => void;
  onCommit: (value: any) => void;
  onReset: (value: any) => void;
}

export function DataInput({
  value,
  onChange,
  name,
  onCommit,
  onReset,
  showReset,
  ...props
}: InputProps) {
  const [focus, setFocus] = useState(false);

  const valid = useMemo(() => {
    try {
      parseValue(value);
      return true;
    } catch (err) {
      return false;
    }
  }, [value]);

  const type = useMemo(() => {
    try {
      const parsed = parseValue(value);
      if (parsed === null) return 'null';
      else if (Array.isArray(parsed)) return 'array';
      else if (parsed.type === 'map') return 'map';
      else if (parsed.type === 'set') return 'set';
      return typeof parsed;
    } catch (err) {
      return 'undefined';
    }
  }, [value]);

  const ref = useRef<HTMLInputElement>(null);

  useMemo(() => {
    if (ref.current) {
      ref.current.setCustomValidity(valid ? '' : 'Invalid input value');
    }
  }, [ref.current, valid]);

  const onKeyUp = useCallback(
    (e: KeyboardEvent) => {
      let parsed: any;
      try {
        parsed = parseValue(value);
      } catch (err) {
        debug(err);
        return;
      }

      if (e.key === 'Enter') {
        onCommit(parsed);
      } else {
        if (typeof parsed === 'number') {
          if (e.key === 'ArrowUp') {
            onChange(String(parsed + 1));
          } else if (e.key === 'ArrowDown') {
            onChange(String(parsed - 1));
          }
        }
      }
    },
    [onChange, value, onCommit],
  );

  const onInput = useCallback(
    (e: Event) => {
      onChange((e.target as any).value);
    },
    [onChange],
  );

  const onCheckboxChange = useCallback(
    (e: Event) => {
      onChange((e.target as any).checked);
    },
    [onChange],
  );

  const onFocus = useCallback(() => setFocus(true), []);
  const onBlur = useCallback(() => setFocus(false), []);

  return (
    <div class={s.valueWrapper}>
      {typeof value === 'boolean' && !focus && (
        <input
          class={s.check}
          type='checkbox'
          checked={value}
          onInput={onCheckboxChange}
        />
      )}
      <div
        class={`${s.innerWrapper} ${
          typeof value === 'boolean' ? s.withCheck : ''
        }`}
      >
        <input
          type='text'
          ref={ref}
          class={`${s.valueInput} ${props.class || ''} ${focus ? s.focus : ''}`}
          value={value === undefined ? '' : value}
          onKeyUp={onKeyUp}
          onInput={onInput}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={props.placeholder}
          data-type={type}
          name={name}
          autoComplete='off'
        />
        <button
          class={`${s.undoBtn} ${showReset ? s.showUndoBtn : ''}`}
          type='button'
          onClick={onReset}
          data-testid={showReset ? 'undo-btn' : 'undo-btn-hidden'}
        >
          <Icon icon='undo' />
        </button>
      </div>
    </div>
  );
}
