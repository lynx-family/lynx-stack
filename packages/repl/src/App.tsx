// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LynxTemplate } from '@lynx-js/web-constants';

import { buildLynxTemplate } from './bundler/template-builder.js';
import { EditorPane } from './components/EditorPane.js';
import type { EditorPaneHandle } from './components/EditorPane.js';
import { Header } from './components/Header.js';
import { PreviewPane } from './components/PreviewPane.js';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './components/ui/resizable.js';
import { useConsole } from './console/useConsole.js';
import {
  clearLocalStorage,
  loadFromLocalStorage,
  saveToLocalStorage,
} from './local-storage.js';
import { samples } from './samples.js';
import { getInitialState, saveSampleToUrl, saveToUrl } from './url-state.js';

const MOBILE_BREAKPOINT = 768;
const SESSION_ID = Math.random().toString(36).slice(2);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// Resolve initial code and sample index from URL > localStorage > default
function resolveInitial(): {
  code: { mainThread: string; background: string; css: string };
  sampleIndex: number | null;
} {
  const urlState = getInitialState();

  if (urlState?.type === 'custom') {
    return { code: urlState.code, sampleIndex: null };
  }

  if (urlState?.type === 'sample') {
    const sample = samples[urlState.sampleIndex];
    return {
      code: {
        mainThread: sample.mainThread,
        background: sample.background,
        css: sample.css,
      },
      sampleIndex: urlState.sampleIndex,
    };
  }

  const cached = loadFromLocalStorage();
  if (cached) {
    return { code: cached, sampleIndex: null };
  }

  const defaultSample = samples[0];
  return {
    code: {
      mainThread: defaultSample.mainThread,
      background: defaultSample.background,
      css: defaultSample.css,
    },
    sampleIndex: 0,
  };
}

const initial = resolveInitial();

export function App() {
  const [layout, setLayout] = useState<'rows' | 'cols'>('rows');
  const [isDark, setIsDark] = useState(true);
  const [sampleIndex, setSampleIndex] = useState<number | null>(
    initial.sampleIndex,
  );
  const [timingText, setTimingText] = useState('');
  const [template, setTemplate] = useState<LynxTemplate | null>(null);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
  const isMobile = useIsMobile();
  const { entries: consoleEntries, clear: clearConsole } = useConsole(
    SESSION_ID,
  );

  const editorPaneRef = useRef<EditorPaneHandle>(null);

  // Set initial theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const rebuild = useCallback(() => {
    const editor = editorPaneRef.current?.editor;
    if (!editor) return;

    clearConsole();

    const t0 = performance.now();
    const { background, mainThread, css } = editor.getCode();

    const { template: newTemplate, timing } = buildLynxTemplate(
      mainThread,
      background,
      css,
      SESSION_ID,
    );
    const t2 = performance.now();

    setTemplate(newTemplate);
    const t3 = performance.now();

    const ms = (v: number) => `${v.toFixed(2)}ms`;
    setTimingText(
      [
        `css-serializer: ${ms(timing['css-serializer'])}`,
        `assemble: ${ms(timing.assemble)}`,
        `render: ${ms(t3 - t2)}`,
        `total: ${ms(t3 - t0)}`,
      ].join('  \u00b7  '),
    );
  }, [clearConsole]);

  // Debounced rebuild + persist
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const debouncedRebuild = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const editor = editorPaneRef.current?.editor;
      if (!editor) return;

      rebuild();

      // Persist current code to localStorage and URL
      const code = editor.getCode();
      saveToLocalStorage(code);
      saveToUrl(code);
      setSampleIndex(null);
    }, 500);
  }, [rebuild]);

  // Initial render + collapse empty panels after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      rebuild();
      editorPaneRef.current?.collapseByContent(initial.code);
    }, 100);
    return () => clearTimeout(timer);
  }, [rebuild]);

  const handleToggleLayout = useCallback(() => {
    setLayout((prev) => (prev === 'rows' ? 'cols' : 'rows'));
  }, []);

  const handleToggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.setAttribute(
        'data-theme',
        next ? 'dark' : 'light',
      );
      editorPaneRef.current?.editor?.setDarkMode(next);
      return next;
    });
  }, []);

  const handleSampleChange = useCallback(
    (index: number) => {
      setSampleIndex(index);
      const sample = samples[index];
      const code = {
        background: sample.background,
        mainThread: sample.mainThread,
        css: sample.css,
      };
      editorPaneRef.current?.editor?.setCode(code);
      editorPaneRef.current?.collapseByContent(code);
      clearLocalStorage();
      saveSampleToUrl(index);
      rebuild();
      // setCode() triggers Monaco's onChange which queues a debouncedRebuild;
      // cancel it so the sample isn't immediately overwritten as custom code.
      clearTimeout(timerRef.current);
    },
    [rebuild],
  );

  const handleShare = useCallback(() => {
    if (sampleIndex === null) {
      const editor = editorPaneRef.current?.editor;
      if (!editor) return;
      saveToUrl(editor.getCode());
    } else {
      saveSampleToUrl(sampleIndex);
    }
    // eslint-disable-next-line n/no-unsupported-features/node-builtins, @typescript-eslint/no-floating-promises
    navigator.clipboard.writeText(window.location.href);
  }, [sampleIndex]);

  return (
    <div className='flex flex-col h-screen'>
      <Header
        layout={layout}
        onToggleLayout={handleToggleLayout}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        sampleIndex={sampleIndex}
        onSampleChange={handleSampleChange}
        onShare={handleShare}
        isMobile={isMobile}
        mobileTab={mobileTab}
        onMobileTabChange={setMobileTab}
      />

      {isMobile
        ? (
          <div className='flex-1 min-h-0'>
            <div
              className='h-full'
              style={{ display: mobileTab === 'editor' ? 'block' : 'none' }}
            >
              <EditorPane
                ref={editorPaneRef}
                layout='rows'
                defaultCode={initial.code}
                onChange={debouncedRebuild}
              />
            </div>
            <div
              className='h-full'
              style={{ display: mobileTab === 'preview' ? 'block' : 'none' }}
            >
              <PreviewPane
                template={template}
                timingText={timingText}
                consoleEntries={consoleEntries}
                onConsoleClear={clearConsole}
              />
            </div>
          </div>
        )
        : (
          <ResizablePanelGroup
            orientation='horizontal'
            className='flex-1 min-h-0'
          >
            <ResizablePanel defaultSize={60} minSize={20}>
              <EditorPane
                ref={editorPaneRef}
                layout={layout}
                defaultCode={initial.code}
                onChange={debouncedRebuild}
              />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={40} minSize={20}>
              <PreviewPane
                template={template}
                timingText={timingText}
                consoleEntries={consoleEntries}
                onConsoleClear={clearConsole}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
    </div>
  );
}
