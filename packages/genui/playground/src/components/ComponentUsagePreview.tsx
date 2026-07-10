// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PreviewViewport } from './PreviewViewport.js';
import { copyToClipboard } from '../utils/clipboard.js';

interface UsageExampleTab {
  label: string;
}

interface UsageExampleTabs {
  items: readonly UsageExampleTab[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

type ComponentPreview =
  | {
    kind: 'ready';
    src: string;
    iframeTitle: string;
    emptyTitle: string;
  }
  | {
    kind: 'invalid';
    title: string;
  };

interface ComponentUsagePreviewProps {
  className?: string;
  editorLabel: string;
  sideHint: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  theme: 'light' | 'dark';
  extensions?: ReactCodeMirrorProps['extensions'];
  error?: string;
  exampleTabs?: UsageExampleTabs;
  preview: ComponentPreview;
}

export function ComponentUsagePreview(props: ComponentUsagePreviewProps) {
  const {
    className,
    editorLabel,
    error,
    exampleTabs,
    extensions,
    hint,
    onChange,
    preview,
    sideHint,
    theme,
    value,
  } = props;
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const copyRequestRef = useRef(0);
  const valueRef = useRef(value);

  const editorExtensions = useMemo(
    () => [
      ...(extensions ?? []),
      EditorView.contentAttributes.of({
        'aria-label': `${editorLabel} editor`,
      }),
    ],
    [editorLabel, extensions],
  );

  useEffect(() => {
    valueRef.current = value;
    copyRequestRef.current += 1;
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = null;
    }
    setCopied(false);
  }, [value]);

  useEffect(() => {
    return () => {
      copyRequestRef.current += 1;
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const sectionClassName = className
    ? `compUsageSection ${className}`
    : 'compUsageSection';

  return (
    <section className={sectionClassName}>
      <div className='compSectionHeader compUsageSectionHeader'>
        <h3 className='compSubheading'>Usage</h3>
        <div className='compPlaygroundSideHint'>{sideHint}</div>
      </div>
      <p className='compUsageHint'>{hint}</p>
      <div className='compEditorPreviewRow'>
        <section className='compUsagePane'>
          {exampleTabs && exampleTabs.items.length > 1
            ? (
              <div className='compUsageExamples'>
                {exampleTabs.items.map((example, index) => (
                  <button
                    key={example.label}
                    className={'compUsageExample'
                      + (exampleTabs.selectedIndex === index ? ' active' : '')}
                    type='button'
                    onClick={() => exampleTabs.onSelect(index)}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            )
            : null}
          <div className='compUsageEditorToolbar'>
            <div className='compUsageEditorLabel'>{editorLabel}</div>
            <button
              className='compCopyBtn'
              type='button'
              title={copied ? 'Copied' : `Copy ${editorLabel}`}
              onClick={() => {
                const copyRequest = ++copyRequestRef.current;
                const copiedValue = value;
                void copyToClipboard(value).then((ok) => {
                  if (
                    !ok
                    || copyRequest !== copyRequestRef.current
                    || copiedValue !== valueRef.current
                  ) return;
                  setCopied(true);
                  if (copiedTimerRef.current !== null) {
                    window.clearTimeout(copiedTimerRef.current);
                  }
                  copiedTimerRef.current = window.setTimeout(() => {
                    setCopied(false);
                    copiedTimerRef.current = null;
                  }, 1200);
                });
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <CodeMirror
            className={theme === 'dark'
              ? 'compUsageEditor compUsageEditorDark'
              : 'compUsageEditor compUsageEditorLight'}
            value={value}
            extensions={editorExtensions}
            onChange={onChange}
            theme={theme}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
            }}
          />
          {error ? <div className='compUsageError'>{error}</div> : null}
        </section>

        <section className='compPreviewPane'>
          <div className='compPreviewStage'>
            {preview.kind === 'ready'
              ? (
                <PreviewViewport
                  key={preview.src}
                  src={preview.src}
                  iframeTitle={preview.iframeTitle}
                  emptyTitle={preview.emptyTitle}
                />
              )
              : <div className='compPreviewInvalid'>{preview.title}</div>}
          </div>
        </section>
      </div>
    </section>
  );
}
