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
}

export function PreviewPane({ template, timingText, consoleEntries, onConsoleClear }: PreviewPaneProps) {
  return (
    <div className="flex flex-col overflow-hidden h-full min-h-0">
      <div
        className="h-[26px] flex items-center px-2.5 text-[11px] font-mono tracking-wide lowercase shrink-0"
        style={{
          background: 'var(--repl-bg-surface)',
          borderBottom: '1px solid var(--repl-border)',
          color: 'var(--repl-text-subtle)',
        }}
      >
        preview
      </div>

      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={70} minSize={20} className="min-h-0">
          <LynxPreview template={template} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          defaultSize={30}
          minSize={10}
          collapsible
          collapsedSize={0}
          className="min-h-0"
        >
          <ConsolePanel entries={consoleEntries} onClear={onConsoleClear} />
        </ResizablePanel>
      </ResizablePanelGroup>

      <div
        className="h-6 flex items-center px-3 text-[11px] font-mono shrink-0 whitespace-nowrap overflow-hidden text-ellipsis"
        style={{
          background: 'var(--repl-bg)',
          borderTop: '1px solid var(--repl-border)',
          color: 'var(--repl-text-dim)',
        }}
      >
        {timingText}
      </div>
    </div>
  );
}
