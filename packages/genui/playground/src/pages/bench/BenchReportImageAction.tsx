// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable n/no-unsupported-features/node-builtins -- Browser-only DOM Blob and URL APIs. */
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { createBenchReportImage } from './benchReportImage.js';
import type { BenchReport } from './benchReportTypes.js';
import { Button } from '../../components/Button.js';
import { Share2 } from '../../components/Icon.js';

type ImageState =
  | { status: 'idle' | 'generating' }
  | { status: 'error'; message: string }
  | { status: 'ready'; blob: Blob; url: string };

export function BenchReportImageAction(props: {
  contentRef: RefObject<HTMLDivElement | null>;
  report: BenchReport;
}) {
  const [state, setState] = useState<ImageState>({ status: 'idle' });
  const [copyNotice, setCopyNotice] = useState('');
  const [copying, setCopying] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const open = state.status !== 'idle';
  const imageUrl = state.status === 'ready' ? state.url : undefined;

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Report changes invalidate captures and previews.
  useEffect(() => {
    generation.current++;
    pending.current = false;
    setState({ status: 'idle' });
    return () => {
      generation.current++;
    };
  }, [props.report]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  function close() {
    generation.current++;
    pending.current = false;
    setState({ status: 'idle' });
  }

  async function generate() {
    if (pending.current || !props.contentRef.current) return;
    pending.current = true;
    const request = ++generation.current;
    setCopyNotice('');
    setCopying(false);
    setState({ status: 'generating' });
    try {
      const blob = await createBenchReportImage(props.contentRef.current);
      if (request !== generation.current) return;
      setState({ status: 'ready', blob, url: URL.createObjectURL(blob) });
    } catch (error) {
      if (request !== generation.current) return;
      setState({
        status: 'error',
        message: error instanceof Error
          ? error.message
          : 'Could not generate the report image.',
      });
    } finally {
      if (request === generation.current) pending.current = false;
    }
  }

  async function copyImage(blob: Blob) {
    const request = generation.current;
    setCopying(true);
    try {
      await window.navigator.clipboard.write([
        new window.ClipboardItem({ 'image/png': blob }),
      ]);
      if (request === generation.current) setCopyNotice('Image copied.');
    } catch {
      if (request === generation.current) {
        setCopyNotice('Could not copy the image. Use Download PNG instead.');
      }
    } finally {
      if (request === generation.current) setCopying(false);
    }
  }

  return (
    <>
      <Button
        size='sm'
        iconBefore={Share2}
        disabled={state.status === 'generating'}
        onClick={() => void generate()}
      >
        {state.status === 'generating'
          ? 'Generating image…'
          : 'Generate share image'}
      </Button>
      <dialog
        ref={dialogRef}
        className='publishedReportImageDialog'
        aria-labelledby='bench-report-image-title'
        aria-describedby='bench-report-image-description'
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <header>
          <h2 id='bench-report-image-title'>Report share image</h2>
          <p id='bench-report-image-description'>
            Full report with the current expanded sections and saved
            screenshots. Generated locally; no upload or sharing link.
          </p>
        </header>
        <div
          className='publishedReportImagePreview'
          aria-busy={state.status === 'generating'}
        >
          {state.status === 'generating' && (
            <p role='status'>
              Generating PNG…
            </p>
          )}
          {state.status === 'error' && <p role='alert'>{state.message}</p>}
          {state.status === 'ready' && (
            <img src={state.url} alt='Bench report share image preview' />
          )}
        </div>
        <footer>
          <span role='status'>{copyNotice}</span>
          {state.status === 'error' && (
            <Button onClick={() => void generate()}>Try again</Button>
          )}
          {state.status === 'ready' && (
            <>
              {typeof window.ClipboardItem === 'function'
                && window.navigator.clipboard?.write && (
                <Button
                  disabled={copying}
                  onClick={() => void copyImage(state.blob)}
                >
                  {copying ? 'Copying…' : 'Copy image'}
                </Button>
              )}
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = state.url;
                  link.download = 'bench-report.png';
                  link.click();
                }}
              >
                Download PNG
              </Button>
            </>
          )}
          <Button onClick={close}>Close</Button>
        </footer>
      </dialog>
    </>
  );
}
