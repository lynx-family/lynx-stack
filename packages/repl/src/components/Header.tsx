/* eslint-disable headers/header-format, sort-imports, import/order, n/file-extension-in-import, unicorn/consistent-function-scoping, @typescript-eslint/prefer-nullish-coalescing */
import { useMemo, useState, useCallback } from 'react';
import {
  Sun,
  Moon,
  Rows3,
  Columns3,
  Link2,
  Check,
  Code2,
  Eye,
} from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { samples } from '../samples.js';

interface HeaderProps {
  layout: 'rows' | 'cols';
  onToggleLayout: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  sampleIndex: number | null;
  onSampleChange: (index: number) => void;
  onShare: () => void;
  isMobile?: boolean;
  mobileTab?: 'editor' | 'preview';
  onMobileTabChange?: (tab: 'editor' | 'preview') => void;
}

export function Header({
  layout,
  onToggleLayout,
  isDark,
  onToggleTheme,
  sampleIndex,
  onSampleChange,
  onShare,
  isMobile,
  mobileTab,
  onMobileTabChange,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [onShare]);

  const tabButtonClass = (active: boolean) =>
    `flex items-center gap-1 font-mono text-[11px] h-8 px-2 sm:px-3 py-1 rounded-md border transition-colors ${
      active
        ? 'bg-[var(--repl-accent)] border-[var(--repl-accent)] text-white'
        : 'bg-[var(--repl-bg-elevated)] hover:bg-[var(--repl-bg-input)] border-[var(--repl-border)] text-[var(--repl-text)]'
    }`;

  // Build grouped options: filter hidden, group by category, preserve original indices
  const groupedOptions = useMemo(() => {
    const groups: {
      category: string;
      items: { index: number; name: string }[];
    }[] = [];
    const categoryMap = new Map<string, { index: number; name: string }[]>();

    samples.forEach((s, i) => {
      if (s.hidden) return;
      const cat = s.category || 'Other';
      if (!categoryMap.has(cat)) {
        const items: { index: number; name: string }[] = [];
        categoryMap.set(cat, items);
        groups.push({ category: cat, items });
      }
      categoryMap.get(cat)!.push({ index: i, name: s.name });
    });

    return groups;
  }, []);

  return (
    <header className='repl-header flex items-center justify-between min-h-10 py-2 px-3 sm:px-5 text-[13px] font-semibold tracking-wide shrink-0 border-b border-[var(--repl-border)] gap-2 text-[var(--repl-text-muted)]'>
      <div className='flex items-center gap-2 min-w-0 flex-1'>
        <span className='hidden sm:inline font-mono text-[12px] text-[var(--repl-text)] shrink-0'>
          LYNX REPL
        </span>
        <Separator
          orientation='vertical'
          className='hidden sm:block h-5 shrink-0'
        />

        {isMobile && onMobileTabChange
          ? (
            <div className='flex items-center gap-1'>
              <button
                className={tabButtonClass(mobileTab === 'editor')}
                onClick={() => onMobileTabChange('editor')}
                title='Editor'
              >
                <Code2 className='h-3.5 w-3.5' />
                <span className='hidden sm:inline'>Editor</span>
              </button>
              <button
                className={tabButtonClass(mobileTab === 'preview')}
                onClick={() => onMobileTabChange('preview')}
                title='Preview'
              >
                <Eye className='h-3.5 w-3.5' />
                <span className='hidden sm:inline'>Preview</span>
              </button>
            </div>
          )
          : (
            <Button
              variant='secondary'
              size='sm'
              onClick={onToggleLayout}
              title='Switch layout'
              className='gap-1.5 font-mono text-[11px] h-8 px-3 py-2 bg-[var(--repl-bg-elevated)] hover:bg-[var(--repl-bg-input)] border border-[var(--repl-border)] text-[var(--repl-text)]'
            >
              {layout === 'rows'
                ? <Rows3 className='h-3.5 w-3.5' />
                : <Columns3 className='h-3.5 w-3.5' />}
              {layout}
            </Button>
          )}

        <select
          className='repl-example-select h-8 min-w-0 flex-1 sm:flex-none sm:w-[200px] rounded-md border border-[var(--repl-border)] bg-[var(--repl-bg-elevated)] px-2 sm:px-3 py-2 font-mono text-[11px] text-[var(--repl-text)] focus:outline-none focus:ring-1 focus:ring-[var(--repl-accent)]'
          value={sampleIndex ?? ''}
          onChange={(e) => onSampleChange(Number(e.target.value))}
          title='Choose example'
        >
          {sampleIndex === null && (
            <option value='' disabled>Custom code</option>
          )}
          {groupedOptions.map((group) => (
            <optgroup key={group.category} label={group.category}>
              {group.items.map((item) => (
                <option key={item.index} value={item.index}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className='flex items-center gap-1.5 shrink-0'>
        <Button
          variant='secondary'
          size='sm'
          onClick={handleShare}
          title='Copy shareable URL'
          className='gap-1.5 font-mono text-[11px] h-8 px-2 sm:px-3 py-2 bg-[var(--repl-bg-elevated)] hover:bg-[var(--repl-bg-input)] border border-[var(--repl-border)] text-[var(--repl-text)]'
        >
          {copied
            ? <Check className='h-3.5 w-3.5' />
            : <Link2 className='h-3.5 w-3.5' />}
          <span className='hidden sm:inline'>
            {copied ? 'Copied!' : 'Share'}
          </span>
        </Button>
        <Button
          variant='secondary'
          size='icon'
          onClick={onToggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className='h-8 w-8 p-2 bg-[var(--repl-bg-elevated)] hover:bg-[var(--repl-bg-input)] border border-[var(--repl-border)] text-[var(--repl-text)]'
        >
          {isDark ? <Moon className='h-4 w-4' /> : <Sun className='h-4 w-4' />}
        </Button>
      </div>
    </header>
  );
}
