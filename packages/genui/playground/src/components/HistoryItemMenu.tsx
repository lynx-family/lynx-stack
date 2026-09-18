// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ComponentType } from 'react';
import { createPortal } from 'react-dom';

import { Button } from './Button.js';
import { EllipsisVertical } from './Icon.js';
import './HistoryItemMenu.css';

interface HistoryAction {
  label: string;
  ariaLabel?: string;
  icon: ComponentType<{ size?: number }>;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export function HistoryItemMenu(props: {
  title: string;
  disabled?: boolean;
  actions: readonly HistoryAction[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusLastRef = useRef(false);
  const visible = open && !props.disabled;

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (props.disabled) close();
  }, [props.disabled, close]);

  useLayoutEffect(() => {
    if (!visible) return;
    const trigger = triggerRef.current!;
    const menu = menuRef.current!;
    const rect = trigger.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(
        8,
        Math.min(
          rect.right - bounds.width,
          window.innerWidth - bounds.width - 8,
        ),
      ),
      top: Math.max(
        8,
        Math.min(
          rect.bottom + bounds.height + 4 <= window.innerHeight - 8
            ? rect.bottom + 4
            : rect.top - bounds.height - 4,
          window.innerHeight - bounds.height - 8,
        ),
      ),
    });
    const items = menu.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    );
    const item = focusLastRef.current ? items[items.length - 1] : items[0];
    item?.focus();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const outside = (event: Event) => {
      if (
        event.target instanceof Node
        && !menuRef.current?.contains(event.target)
        && !triggerRef.current?.contains(event.target)
      ) close();
    };
    const onScroll = (event: Event) => {
      if (
        event.target instanceof Node && menuRef.current?.contains(event.target)
      ) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [visible, close]);

  return (
    <>
      <Button
        ref={triggerRef}
        className='historyItemMenuTrigger'
        variant='ghost'
        size='sm'
        iconOnly
        iconBefore={EllipsisVertical}
        disabled={props.disabled}
        aria-label={`Actions for ${props.title}`}
        title='More actions'
        aria-haspopup='menu'
        aria-expanded={visible}
        aria-controls={visible ? id : undefined}
        onClick={() => {
          focusLastRef.current = false;
          setOpen(!visible);
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusLastRef.current = event.key === 'ArrowUp';
            setOpen(true);
          }
        }}
      />
      {visible && createPortal(
        <div
          ref={menuRef}
          id={id}
          className='historyItemMenu'
          role='menu'
          aria-label={`Actions for ${props.title}`}
          style={position}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            } else if (event.key === 'Tab') {
              close(true);
            } else if (
              ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
            ) {
              event.preventDefault();
              const items = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="menuitem"]:not(:disabled)',
                ),
              ];
              const current = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const next = event.key === 'Home' ? 0 : (event.key === 'End'
                ? items.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1)
                  + items.length) % items.length);
              items[next]?.focus();
            }
          }}
        >
          {props.actions.map(({ icon: Icon, ...action }) => (
            <button
              type='button'
              role='menuitem'
              tabIndex={-1}
              key={action.label}
              aria-label={action.ariaLabel}
              data-danger={action.danger}
              disabled={action.disabled}
              onClick={() => {
                close(true);
                action.onSelect();
              }}
            >
              <Icon size={14} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
