/* eslint-disable headers/header-format, sort-imports, import/order, n/file-extension-in-import */
import { RotateCw } from 'lucide-react';
import type { LynxTemplate } from '@lynx-js/web-constants';
import { LynxPreview } from './LynxPreview';
import { ConsolePanel } from './ConsolePanel';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from './ui/resizable';
import type { ConsoleEntry } from '../console/types.js';

interface PreviewPaneProps {
  template: LynxTemplate | null;
  timingText: string;
  consoleEntries: ConsoleEntry[];
  onConsoleClear: () => void;
  isDark: boolean;
  onLoad?: () => void;
  onReload?: () => void;
}

export function PreviewPane(
  {
    template,
    timingText,
    consoleEntries,
    onConsoleClear,
    isDark,
    onLoad,
    onReload,
  }: PreviewPaneProps,
) {
  return (
    <div className='flex flex-col overflow-hidden h-full min-h-0'>
      <div
        className='h-7 flex items-center px-3 text-[11px] font-mono tracking-wide lowercase shrink-0'
        style={{
          background: 'var(--repl-bg-surface)',
          borderBottom: '1px solid var(--repl-border)',
          color: 'var(--repl-text-subtle)',
        }}
      >
        <span className='flex-1'>preview</span>
        {onReload && (
          <button
            onClick={onReload}
            title='Reload preview'
            className='flex items-center justify-center h-5 w-5 rounded hover:bg-[var(--repl-bg-input)] transition-colors'
            style={{ color: 'var(--repl-text-dim)' }}
          >
            <RotateCw className='h-3 w-3' />
          </button>
        )}
      </div>

      <ResizablePanelGroup orientation='vertical' className='flex-1 min-h-0'>
        <ResizablePanel defaultSize={70} minSize={20} className='min-h-0'>
          <LynxPreview template={template} isDark={isDark} onLoad={onLoad} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          defaultSize={30}
          minSize={10}
          collapsible
          collapsedSize={0}
          className='min-h-0'
        >
          <ConsolePanel
            entries={consoleEntries}
            onClear={onConsoleClear}
            timingText={timingText}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
