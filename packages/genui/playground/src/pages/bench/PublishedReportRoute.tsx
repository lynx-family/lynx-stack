// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useRef, useState } from 'react';

import { BenchReportImageAction } from './BenchReportImageAction.js';
import { serializeBenchReport } from './benchReportSerialization.js';
import type { BenchReport } from './benchReportTypes.js';
import {
  BENCH_HISTORY_STORAGE_KEY,
  BENCH_SELECTED_REPORT_STORAGE_KEY,
  loadPublishedReport,
} from './publishedReportLoader.js';
import { PublishedReportPage } from './PublishedReportPage.js';
import { Button } from '../../components/Button.js';
import { Copy } from '../../components/Icon.js';
import { copyToClipboard } from '../../utils/clipboard.js';

type ReportState =
  | { status: 'ready'; report: BenchReport }
  | { status: 'error'; error: string };

function readLocalReport(reportId: string): ReportState {
  if (typeof window === 'undefined') {
    return {
      status: 'error',
      error: 'Open this page in the browser that saved the Bench history.',
    };
  }
  try {
    return {
      status: 'ready',
      report: loadPublishedReport(
        reportId,
        window.localStorage,
        window.sessionStorage,
      ),
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error
        ? error.message
        : 'Local Bench history could not be read.',
    };
  }
}

export function PublishedReportRoute(props: { reportId: string }) {
  const [state, setState] = useState<ReportState>(() =>
    readLocalReport(props.reportId)
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const [copyNotice, setCopyNotice] = useState('');

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null || event.key === BENCH_HISTORY_STORAGE_KEY
        || event.key === BENCH_SELECTED_REPORT_STORAGE_KEY
      ) {
        setState(readLocalReport(props.reportId));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [props.reportId]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Local Bench report · GenUI';
    return () => {
      document.title = previous;
    };
  }, []);

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
          <Button onClick={() => setState(readLocalReport(props.reportId))}>
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
