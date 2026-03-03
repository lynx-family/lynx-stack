// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Minus, Plus } from 'lucide-react';
import type React from 'react';

import { Button } from './ui/button.js';

interface EditorWindowHeaderProps {
  title: string;
  collapsed: boolean;
  layout: 'rows' | 'cols';
  onToggle: () => void;
}

export function EditorWindowHeader(
  { title, collapsed, layout, onToggle }: EditorWindowHeaderProps,
) {
  // Collapsed in cols mode: narrow vertical strip — expand button on top, rotated title below.
  if (collapsed && layout === 'cols') {
    return (
      <div
        className='flex flex-col items-center flex-1 min-h-0 pt-1.5 pb-3 select-none cursor-pointer'
        style={{ background: 'var(--repl-bg-surface)' }}
        onClick={onToggle}
        title='Expand'
      >
        <Button
          variant='ghost'
          size='icon'
          className='h-5 w-5 shrink-0 text-base font-mono pointer-events-none'
          style={{ color: 'var(--repl-text-faint)' }}
        >
          <Plus className='h-3 w-3' />
        </Button>
        <span
          className='text-[11px] font-mono tracking-wide lowercase mt-2'
          style={{
            color: 'var(--repl-text-subtle)',
            writingMode: 'vertical-rl',
          }}
        >
          {title}
        </span>
      </div>
    );
  }

  // Normal horizontal header (rows mode, or cols mode when expanded).
  return (
    <div
      className='flex items-center justify-between h-7 px-3 shrink-0 select-none cursor-pointer'
      style={{
        background: 'var(--repl-bg-surface)',
        borderBottom: '1px solid var(--repl-border)',
      }}
      onClick={onToggle}
      title={collapsed ? 'Expand' : 'Collapse'}
    >
      <span
        className='text-[11px] font-mono tracking-wide lowercase'
        style={{ color: 'var(--repl-text-subtle)' }}
      >
        {title}
      </span>
      <Button
        variant='ghost'
        size='icon'
        className='h-5 w-5 text-base font-mono pointer-events-none'
        style={{ color: 'var(--repl-text-faint)' }}
      >
        {collapsed
          ? <Plus className='h-3 w-3' />
          : <Minus className='h-3 w-3' />}
      </Button>
    </div>
  );
}

interface EditorWindowBodyProps {
  id: string;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  hidden?: boolean;
}

export function EditorWindowBody(
  { id, bodyRef, hidden }: EditorWindowBodyProps,
) {
  return (
    <div
      id={id}
      className='flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden'
      style={hidden ? { display: 'none' } : undefined}
    >
      <div className='flex-1 min-h-0 min-w-0' ref={bodyRef} />
    </div>
  );
}
