// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { PanelImperativeHandle, PanelSize } from 'react-resizable-panels';

import { createEditor } from '../editor.js';
import type { EditorInstance } from '../editor.js';
import { EditorWindowBody, EditorWindowHeader } from './EditorWindow.js';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './ui/resizable.js';

export interface EditorPaneHandle {
  editor: EditorInstance | null;
  /** Collapse panels whose corresponding code is empty, expand those with content. */
  collapseByContent(
    code: { mainThread: string; background: string; css: string },
  ): void;
}

interface EditorPaneProps {
  layout: 'rows' | 'cols';
  defaultCode: { mainThread: string; background: string; css: string };
  onChange: () => void;
}

/** Height/width of a collapsed panel in px (main-axis size). */
const COLLAPSED_SIZE_PX = 30;

/** Monaco editor line height: Math.round(1.5 × fontSize=13) */
const LINE_HEIGHT_PX = 20;
/** From EDITOR_OPTIONS padding.top */
const MONACO_TOP_PADDING_PX = 4;
/** EditorWindowHeader min-h-[26px] */
const HEADER_HEIGHT_PX = 26;
/** Bottom buffer for scrollbar / focus ring */
const MONACO_BOTTOM_BUFFER_PX = 8;

/** Estimate the pixel height a panel needs to display `code` without scrolling. */
function naturalHeightPx(code: string): number {
  const lines = (code.match(/\n/g)?.length ?? 0) + 1;
  return (
    HEADER_HEIGHT_PX
    + MONACO_TOP_PADDING_PX
    + lines * LINE_HEIGHT_PX
    + MONACO_BOTTOM_BUFFER_PX
  );
}

const WINDOWS = [
  {
    id: 'window-main-thread',
    title: 'main-thread.js',
    key: 'mainThread' as const,
  },
  {
    id: 'window-background',
    title: 'background.js',
    key: 'background' as const,
  },
  { id: 'window-css', title: 'index.css', key: 'css' as const },
];

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  function EditorPane({ layout, defaultCode, onChange }, ref) {
    const mainThreadRef = useRef<HTMLDivElement>(null);
    const backgroundRef = useRef<HTMLDivElement>(null);
    const cssRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<EditorInstance | null>(null);

    // Ref to the panel group's root element for measuring available space
    const groupElementRef = useRef<HTMLDivElement | null>(null);

    // Individual panel refs stored in a stable ref container so useCallback
    // closures always see the current handles without needing them as deps.
    const panel0Ref = useRef<PanelImperativeHandle | null>(null);
    const panel1Ref = useRef<PanelImperativeHandle | null>(null);
    const panel2Ref = useRef<PanelImperativeHandle | null>(null);
    const panelRefs = useRef([panel0Ref, panel1Ref, panel2Ref]);

    const [collapsedStates, setCollapsedStates] = useState([
      false,
      false,
      false,
    ]);

    /**
     * Distribute space among expanded panels, shrinking panels whose natural
     * content height is less than their equal share and giving surplus to others.
     * Falls back to equal distribution for panels that want more space.
     */
    const distributeByContent = useCallback(
      (
        collapsed: boolean[],
        code: { mainThread: string; background: string; css: string },
      ) => {
        const expandedIndices: number[] = [];
        collapsed.forEach((c, i) => {
          if (!c) expandedIndices.push(i);
        });
        if (expandedIndices.length === 0) return;

        const el = groupElementRef.current;
        if (!el) return;
        const totalPx = layout === 'rows' ? el.offsetHeight : el.offsetWidth;
        if (!totalPx) return;

        const collapsedCount = collapsed.filter(Boolean).length;
        const remainingPx = totalPx - collapsedCount * COLLAPSED_SIZE_PX;

        const codeValues = [code.mainThread, code.background, code.css];
        const naturalHeights = WINDOWS.map((_, i) =>
          naturalHeightPx(codeValues[i] ?? '')
        );

        // Iteratively cap panels whose natural height < their equal share,
        // redistributing the surplus to uncapped panels.
        const sizes: number[] = [0, 0, 0];
        let uncapped = [...expandedIndices];
        let available = remainingPx;

        while (uncapped.length > 0) {
          const share = available / uncapped.length;
          const nowCapped: number[] = [];

          for (const i of uncapped) {
            if (naturalHeights[i] < share) {
              sizes[i] = naturalHeights[i];
              nowCapped.push(i);
            }
          }

          if (nowCapped.length === 0) {
            // All remaining panels want at least their share — split equally
            for (const i of uncapped) {
              sizes[i] = share;
            }
            break;
          }

          available -= nowCapped.reduce((sum, i) => sum + sizes[i], 0);
          uncapped = uncapped.filter(i => !nowCapped.includes(i));
        }

        for (const i of expandedIndices) {
          panelRefs.current[i]?.current?.resize(
            Math.max(sizes[i], COLLAPSED_SIZE_PX + 1),
          );
        }
      },
      [layout],
    );

    /**
     * Resize all currently-expanded panels to equal shares of the remaining space.
     * `collapsed` is the intended target state (already applied to the panel refs).
     */
    const distributeEqual = useCallback((collapsed: boolean[]) => {
      const expandedIndices: number[] = [];
      collapsed.forEach((c, i) => {
        if (!c) expandedIndices.push(i);
      });
      if (expandedIndices.length === 0) return; // all collapsed – nothing to distribute

      const el = groupElementRef.current;
      if (!el) return;
      const totalPx = layout === 'rows' ? el.offsetHeight : el.offsetWidth;
      if (!totalPx) return;

      const collapsedCount = collapsed.filter(Boolean).length;
      const remainingPx = totalPx - collapsedCount * COLLAPSED_SIZE_PX;
      const perPanelPx = Math.max(
        remainingPx / expandedIndices.length,
        COLLAPSED_SIZE_PX + 1,
      );

      for (const i of expandedIndices) {
        panelRefs.current[i]?.current?.resize(perPanelPx);
      }
    }, [layout]);

    // Track collapsed state when the user drags panels; use the library's own isCollapsed()
    // rather than a pixel comparison to avoid false positives during mid-drag.
    const makeResizeHandler = useCallback((index: number) => {
      return (_size: PanelSize) => {
        const isCollapsed = panelRefs.current[index]?.current?.isCollapsed()
          ?? false;
        setCollapsedStates(prev => {
          if (prev[index] === isCollapsed) return prev;
          const next = [...prev];
          next[index] = isCollapsed;
          return next;
        });
      };
    }, []);

    /**
     * Apply a target collapsed state to all panels, then redistribute space.
     * Pass a custom `distributeFn` for content-aware sizing; omit for equal split.
     * This is the single shared path used by both toggle and collapseByContent.
     */
    const applyCollapsedState = useCallback(
      (
        newCollapsed: boolean[],
        distributeFn?: (collapsed: boolean[]) => void,
      ) => {
        panelRefs.current.forEach((pRef, i) => {
          const panel = pRef.current;
          if (!panel) return;
          if (newCollapsed[i]) {
            if (!panel.isCollapsed()) panel.collapse();
          } else {
            if (panel.isCollapsed()) panel.expand();
          }
        });
        setCollapsedStates(newCollapsed);
        requestAnimationFrame(() =>
          (distributeFn ?? distributeEqual)(newCollapsed)
        );
      },
      [distributeEqual],
    );

    const handleToggle = useCallback((index: number) => {
      const panel = panelRefs.current[index]?.current;
      if (!panel) return;
      const willCollapse = !panel.isCollapsed();
      const newCollapsed = panelRefs.current.map((pRef, i) =>
        i === index ? willCollapse : (pRef.current?.isCollapsed() ?? false)
      );
      applyCollapsedState(newCollapsed);
    }, [applyCollapsedState]);

    useImperativeHandle(ref, () => ({
      get editor() {
        return editorRef.current;
      },
      collapseByContent(
        code: { mainThread: string; background: string; css: string },
      ) {
        const values = [code.mainThread, code.background, code.css] as const;
        const newCollapsed = values.map(v => !v?.trim());
        applyCollapsedState(
          newCollapsed,
          collapsed => distributeByContent(collapsed, code),
        );
      },
    }), [applyCollapsedState, distributeByContent]);

    // When the layout orientation changes, reset all panels to equal expanded state.
    const prevLayoutRef = useRef(layout);
    useEffect(() => {
      if (prevLayoutRef.current === layout) return;
      prevLayoutRef.current = layout;
      applyCollapsedState([false, false, false]);
    }, [layout, applyCollapsedState]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only; defaultCode and onChange are stable initial values
    useEffect(() => {
      if (
        mainThreadRef.current && backgroundRef.current && cssRef.current
        && !editorRef.current
      ) {
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
    }, []);

    const bodyRefs = [mainThreadRef, backgroundRef, cssRef];

    return (
      <ResizablePanelGroup
        orientation={layout === 'rows' ? 'vertical' : 'horizontal'}
        className='h-full'
        elementRef={groupElementRef}
      >
        {WINDOWS.map((win, i) => (
          <React.Fragment key={win.id}>
            {i > 0 && <ResizableHandle />}
            <ResizablePanel
              id={win.id}
              defaultSize='33%'
              minSize={60}
              collapsible
              collapsedSize={COLLAPSED_SIZE_PX}
              onResize={makeResizeHandler(i)}
              panelRef={panelRefs.current[i]}
            >
              <div className='flex flex-col h-full w-full overflow-hidden'>
                <EditorWindowHeader
                  title={win.title}
                  collapsed={collapsedStates[i]}
                  layout={layout}
                  onToggle={() => handleToggle(i)}
                />
                <EditorWindowBody
                  id={win.id}
                  bodyRef={bodyRefs[i]}
                  hidden={collapsedStates[i]}
                />
              </div>
            </ResizablePanel>
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    );
  },
);
