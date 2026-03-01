import type { LynxTemplate } from '@lynx-js/web-constants';
import { LynxPreview } from './LynxPreview';

interface PreviewPaneProps {
  template: LynxTemplate | null;
  timingText: string;
}

export function PreviewPane({ template, timingText }: PreviewPaneProps) {
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
      <LynxPreview template={template} />
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
