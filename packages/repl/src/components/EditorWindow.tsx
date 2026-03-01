import React, { useCallback } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { Minus, Plus } from 'lucide-react';
import { Button } from './ui/button';

interface EditorWindowProps {
  id: string;
  title: string;
  panelRef: React.RefObject<PanelImperativeHandle | null>;
  bodyRef: React.RefObject<HTMLDivElement | null>;
}

export function EditorWindow({ id, title, panelRef, bodyRef }: EditorWindowProps) {
  const handleToggle = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [panelRef]);

  return (
    <div id={id} className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
      <div
        className="flex items-center justify-between min-h-[26px] py-1.5 px-3 shrink-0 select-none"
        style={{ background: 'var(--repl-bg-surface)', borderBottom: '1px solid var(--repl-border)' }}
      >
        <span
          className="text-[11px] font-mono tracking-wide lowercase"
          style={{ color: 'var(--repl-text-subtle)' }}
        >
          {title}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-[18px] w-5 text-base font-mono"
          onClick={handleToggle}
          title="Collapse/Expand"
          style={{ color: 'var(--repl-text-faint)' }}
        >
          <Minus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 min-w-0" ref={bodyRef} />
    </div>
  );
}
