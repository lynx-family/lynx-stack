// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useRef, useState } from 'react';

export interface BenchDropdownOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export function BenchDropdown<T extends string>(props: {
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: T) => void;
  options: readonly BenchDropdownOption<T>[];
  value: T;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = props.options.find((option) => option.value === props.value)
    ?? props.options[0];

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node
        && !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div
      className='benchDropdown'
      data-disabled={props.disabled ?? undefined}
      data-open={open ? true : undefined}
      ref={rootRef}
    >
      <button
        type='button'
        className='benchDropdownTrigger'
        aria-expanded={open}
        aria-label={props.ariaLabel}
        disabled={props.disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? props.value}</span>
      </button>
      {open && !props.disabled
        ? (
          <div
            className='benchDropdownMenu'
            role='group'
            aria-label={props.ariaLabel}
          >
            {props.options.map((option) => (
              <button
                type='button'
                aria-pressed={option.value === props.value}
                data-selected={option.value === props.value || undefined}
                key={option.value}
                onClick={() => {
                  props.onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {option.description
                  ? <small>{option.description}</small>
                  : null}
              </button>
            ))}
          </div>
        )
        : null}
    </div>
  );
}
