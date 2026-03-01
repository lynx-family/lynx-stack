import { useRef, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import type { ConsoleEntry, ConsoleSource } from '../console/types.js';

type FilterTab = 'all' | ConsoleSource;

const TABS: FilterTab[] = ['all', 'main-thread', 'background'];

interface ConsolePanelProps {
  entries: ConsoleEntry[];
  onClear: () => void;
}

export function ConsolePanel({ entries, onClear }: ConsolePanelProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div
        className="h-[26px] flex items-center justify-between px-2.5 shrink-0 select-none"
        style={{
          background: 'var(--repl-bg-surface)',
          borderTop: '1px solid var(--repl-border)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] font-mono tracking-wide lowercase"
            style={{ color: 'var(--repl-text-subtle)' }}
          >
            console
          </span>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                filter === tab
                  ? 'bg-[var(--repl-accent)] text-white'
                  : 'text-[var(--repl-text-dim)] hover:text-[var(--repl-text-subtle)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-[18px] w-5"
          onClick={onClear}
          title="Clear console"
          style={{ color: 'var(--repl-text-faint)' }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto font-mono text-[12px] leading-[18px]"
        style={{ background: 'var(--repl-bg)' }}
      >
        {filtered.length === 0 ? (
          <div
            className="px-3 py-2 text-[11px]"
            style={{ color: 'var(--repl-text-dim)' }}
          >
            No console output yet.
          </div>
        ) : (
          filtered.map(entry => (
            <ConsoleEntryRow key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}

function ConsoleEntryRow({ entry }: { entry: ConsoleEntry }) {
  const levelStyles: Record<string, { color: string; bg: string; border: string }> = {
    log:   { color: 'var(--repl-text)',             bg: 'transparent',                    border: 'var(--repl-border)' },
    info:  { color: 'var(--repl-console-info)',     bg: 'transparent',                    border: 'var(--repl-border)' },
    warn:  { color: 'var(--repl-console-warn)',     bg: 'var(--repl-console-warn-bg)',     border: 'var(--repl-console-warn)' },
    error: { color: 'var(--repl-error-text)',       bg: 'var(--repl-console-error-bg)',    border: 'var(--repl-error-border)' },
    debug: { color: 'var(--repl-text-dim)',         bg: 'transparent',                    border: 'var(--repl-border)' },
  };

  const style = levelStyles[entry.level] || levelStyles.log!;
  const sourceLabel = entry.source === 'main-thread' ? 'MT' : 'BG';

  return (
    <div
      className="flex items-start px-3 py-[2px] gap-2"
      style={{
        color: style.color,
        background: style.bg,
        borderBottom: `1px solid color-mix(in srgb, ${style.border} 30%, transparent)`,
      }}
    >
      <span
        className="text-[9px] font-mono shrink-0 mt-[3px] px-1 rounded"
        style={{
          color: 'var(--repl-text-dim)',
          background: 'var(--repl-bg-elevated)',
        }}
      >
        {sourceLabel}
      </span>
      <span className="flex-1 whitespace-pre-wrap break-all">
        {entry.args.join(' ')}
      </span>
    </div>
  );
}
