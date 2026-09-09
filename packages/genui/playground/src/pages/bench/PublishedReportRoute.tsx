// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useRef, useState } from 'react';

import { BenchReportImageAction } from './BenchReportImageAction.js';
import { serializeBenchReport } from './benchReportSerialization.js';
import type { BenchReport } from './benchReportTypes.js';
import { loadPublishedReport } from './publishedReportLoader.js';
import { PublishedReportPage } from './PublishedReportPage.js';
import { Button } from '../../components/Button.js';
import { Copy } from '../../components/Icon.js';
import { subscribeBenchHistory } from '../../storage/benchRepo.js';
import { copyToClipboard } from '../../utils/clipboard.js';

type ReportState =
  | { status: 'loading' }
  | { status: 'ready'; report: BenchReport }
  | { status: 'error'; error: string };

export function PublishedReportRoute(props: { reportId: string }) {
  const [state, setState] = useState<ReportState>(() =>
    typeof window === 'undefined'
      ? {
        status: 'error',
        error: 'Open this page in the browser that saved the Bench history.',
      }
      : { status: 'loading' }
  );
  const [reload, setReload] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const [copyNotice, setCopyNotice] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload explicitly retries a failed database read.
  useEffect(() => {
    let active = true;
    let revision = 0;
    setState({ status: 'loading' });
    const refresh = () => {
      const request = ++revision;
      void loadPublishedReport(props.reportId).then((report) => {
        if (active && request === revision) {
          setState({ status: 'ready', report });
        }
      }).catch((error: unknown) => {
        if (active && request === revision) {
          setState({
            status: 'error',
            error: error instanceof Error
              ? error.message
              : 'Local Bench history could not be read.',
          });
        }
      });
    };
    refresh();
    const unsubscribe = subscribeBenchHistory(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [props.reportId, reload]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Local Bench report · GenUI';
    return () => {
      document.title = previous;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <main className='publishedReportPage'>
        <p role='status'>Loading saved report…</p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className='publishedReportPage'>
        <div className='publishedReportContent'>
          <a href='#/bench'>← Bench</a>
          <h1>Report unavailable</h1>
          <p role='alert'>{state.error}</p>
          <p className='publishedReportShareNote'>
            Reports currently display only history saved in this browser on this
            site. Open a report from Bench history. Link-based sharing is not
            enabled.
          </p>
          <Button onClick={() => setReload((value) => value + 1)}>
            Reload report
          </Button>
        </div>
      </main>
    );
  }
  const report = state.report;
  return (
    <PublishedReportPage
      report={report}
      contentRef={contentRef}
      actions={
        <>
          {copyNotice && <span role='status'>{copyNotice}</span>}
          <Button
            size='sm'
            iconBefore={Copy}
            onClick={() => {
              void copyToClipboard(serializeBenchReport(report)).then(
                (copied) => {
                  setCopyNotice(
                    copied
                      ? 'JSON copied.'
                      : 'Could not copy JSON. Please try again.',
                  );
                },
              );
            }}
          >
            Copy Report JSON
          </Button>
          <BenchReportImageAction contentRef={contentRef} report={report} />
        </>
      }
    />
  );
}
