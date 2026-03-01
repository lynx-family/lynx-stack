import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { createEditor, type EditorInstance } from '../editor.js';
import { EditorWindow } from './EditorWindow';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from './ui/resizable';

export interface EditorPaneHandle {
  editor: EditorInstance | null;
  /** Collapse panels whose corresponding code is empty, expand those with content. */
  collapseByContent(code: { mainThread: string; background: string; css: string }): void;
}

interface EditorPaneProps {
  layout: 'rows' | 'cols';
  defaultCode: { mainThread: string; background: string; css: string };
  onChange: () => void;
}

const WINDOWS = [
  { id: 'window-main-thread', title: 'main-thread.js', key: 'mainThread' as const },
  { id: 'window-background', title: 'background.js', key: 'background' as const },
  { id: 'window-css', title: 'index.css', key: 'css' as const },
];

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  function EditorPane({ layout, defaultCode, onChange }, ref) {
    const mainThreadRef = useRef<HTMLDivElement>(null);
    const backgroundRef = useRef<HTMLDivElement>(null);
    const cssRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<EditorInstance | null>(null);

    const panelRefs = [
      useRef<PanelImperativeHandle>(null),
      useRef<PanelImperativeHandle>(null),
      useRef<PanelImperativeHandle>(null),
    ];

    useImperativeHandle(ref, () => ({
      get editor() {
        return editorRef.current;
      },
      collapseByContent(code: { mainThread: string; background: string; css: string }) {
        const values = [code.mainThread, code.background, code.css];
        panelRefs.forEach((pRef, i) => {
          const panel = pRef.current;
          if (!panel) return;
          if (values[i]?.trim()) {
            if (panel.isCollapsed()) panel.expand();
          } else {
            if (!panel.isCollapsed()) panel.collapse();
          }
        });
      },
    }));

    // Create Monaco editors once
    useEffect(() => {
      if (mainThreadRef.current && backgroundRef.current && cssRef.current && !editorRef.current) {
        editorRef.current = createEditor(
          {
            mainThread: mainThreadRef.current,
            background: backgroundRef.current,
            css: cssRef.current,
          },
          defaultCode,
          onChange,
        );
      }
      return () => {
        editorRef.current?.dispose();
        editorRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const bodyRefs = [mainThreadRef, backgroundRef, cssRef];

    return (
      <ResizablePanelGroup
        orientation={layout === 'rows' ? 'vertical' : 'horizontal'}
        className="h-full"
      >
        {WINDOWS.map((win, i) => (
          <React.Fragment key={win.id}>
            {i > 0 && <ResizableHandle />}
            <ResizablePanel
              defaultSize={100 / 3}
              minSize={5}
              collapsible
              collapsedSize={0}
              panelRef={panelRefs[i]}
            >
              <EditorWindow
                id={win.id}
                title={win.title}
                panelRef={panelRefs[i]}
                bodyRef={bodyRefs[i]!}
              />
            </ResizablePanel>
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    );
  },
);
