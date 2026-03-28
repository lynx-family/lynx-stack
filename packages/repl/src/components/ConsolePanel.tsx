// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ConsoleEntry, ConsoleSource } from '../console/types.js';
import { Button } from './ui/button.js';

type FilterTab = 'all' | ConsoleSource;

const TABS: FilterTab[] = ['all', 'main-thread', 'background'];

interface ConsolePanelProps {
  entries: ConsoleEntry[];
  onClear: () => void;
  timingText?: string;
}

export function ConsolePanel(
  { entries, onClear, timingText }: ConsolePanelProps,
) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — scroll only when entry count changes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries.length]);

  const filtered = filter === 'all'
    ? entries
    : entries.filter(e => e.source === filter);

  return (
    <div className='flex flex-col h-full min-h-0 overflow-hidden'>
      <div
        className='h-7 flex items-center justify-between px-3 shrink-0 select-none'
        style={{
          background: 'var(--repl-bg-surface)',
        }}
      >
        <div className='flex items-center gap-1.5 h-full'>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`text-[10px] font-mono px-1.5 h-full border-b-2 transition-colors ${
                filter === tab
                  ? 'border-[var(--repl-accent)] text-[var(--repl-text)]'
                  : 'border-transparent text-[var(--repl-text-dim)] hover:text-[var(--repl-text-subtle)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <Button
          variant='ghost'
          size='icon'
          className='h-5 w-5'
          onClick={onClear}
          title='Clear console'
          style={{ color: 'var(--repl-text-faint)' }}
        >
          <Trash2 className='h-3 w-3' />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className='flex-1 min-h-0 overflow-y-auto font-mono text-[12px] leading-[18px]'
        style={{ background: 'var(--repl-bg)' }}
      >
        {timingText && (
          <div
            className='px-3 py-[2px] text-[11px] font-mono whitespace-nowrap overflow-x-auto'
            style={{
              color: 'var(--repl-text-dim)',
              borderBottom:
                '1px solid color-mix(in srgb, var(--repl-border) 30%, transparent)',
            }}
          >
            {timingText}
          </div>
        )}
        {filtered.length === 0 && !timingText
          ? (
            <div
              className='px-3 py-2 text-[11px]'
              style={{ color: 'var(--repl-text-dim)' }}
            >
              No console output yet.
            </div>
          )
          : (
            filtered.map(entry => (
              <ConsoleEntryRow key={entry.id} entry={entry} />
            ))
          )}
      </div>
    </div>
  );
}

function ConsoleEntryRow({ entry }: { entry: ConsoleEntry }) {
  const levelStyles: Record<
    string,
    { color: string; bg: string; border: string }
  > = {
    log: {
      color: 'var(--repl-text)',
      bg: 'transparent',
      border: 'var(--repl-border)',
    },
    info: {
      color: 'var(--repl-console-info)',
      bg: 'transparent',
      border: 'var(--repl-border)',
    },
    warn: {
      color: 'var(--repl-console-warn)',
      bg: 'var(--repl-console-warn-bg)',
      border: 'var(--repl-console-warn)',
    },
    error: {
      color: 'var(--repl-error-text)',
      bg: 'var(--repl-console-error-bg)',
      border: 'var(--repl-error-border)',
    },
    debug: {
      color: 'var(--repl-text-dim)',
      bg: 'transparent',
      border: 'var(--repl-border)',
    },
  };

  const style = levelStyles[entry.level] ?? levelStyles.log;
  const sourceLabel = entry.source === 'main-thread' ? 'MT' : 'BG';

  return (
    <div
      className='flex items-center px-3 py-[2px] gap-2'
      style={{
        color: style.color,
        background: style.bg,
        borderBottom:
          `1px solid color-mix(in srgb, ${style.border} 30%, transparent)`,
      }}
    >
      <span
        className='text-[9px] font-mono shrink-0 px-1 rounded'
        style={{
          color: 'var(--repl-text-dim)',
          background: 'var(--repl-bg-elevated)',
        }}
      >
        {sourceLabel}
      </span>
      <span className='flex-1 whitespace-pre-wrap break-all'>
        {entry.args.join(' ')}
      </span>
    </div>
  );
}
