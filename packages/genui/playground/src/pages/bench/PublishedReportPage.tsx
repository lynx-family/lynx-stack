// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useMemo, useState } from 'react';
import type { ReactNode, Ref } from 'react';

import { getBenchProtocolLabel } from './benchData.js';
import type { BenchGroupSummary, BenchReport } from './benchReportTypes.js';
import { createBenchScreenshotReader } from './benchScreenshot.js';
import { BenchScreenshotsDialog } from './BenchScreenshotsDialog.js';
import { BenchTokens } from './BenchTokens.js';
import {
  groupBenchTokenUsage,
  readBenchTokenUsage,
} from './benchTokenUsage.js';
import { Button } from '../../components/Button.js';
import { Maximize2 } from '../../components/Icon.js';
import './BenchPage.css';
import './PublishedReportPage.css';

const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function formatNumber(value: number): string {
  return Number.isFinite(value) ? numbers.format(value) : 'Not recorded';
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) return 'Not recorded';
  return value >= 1000
    ? `${numbers.format(value / 1000)}s`
    : `${numbers.format(value)}ms`;
}

function judgeScore(report: BenchReport, summary: BenchGroupSummary): string {
  if (
    !report.settings.judgeEnabled || report.capabilities?.judge === 'disabled'
  ) return 'Disabled';
  if (!summary.judgeRunCount || !Number.isFinite(summary.avgJudgeScore)) {
    return 'Not evaluated';
  }
  return `${numbers.format(summary.avgJudgeScore)} / 5`;
}

/** One read-only template for every historical Bench job, regardless of protocol or experiment. */
export function PublishedReportPage(
  props: {
    report: BenchReport;
    actions?: ReactNode;
    contentRef?: Ref<HTMLDivElement>;
  },
) {
  const report = useMemo(() => {
    const readScreenshot = createBenchScreenshotReader();
    return {
      ...props.report,
      results: props.report.results.map((result) => ({
        ...result,
        screenshotDataUrl: readScreenshot(result.screenshotDataUrl),
      })),
    };
  }, [props.report]);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const total = report.summary?.totalRuns
    ?? report.groups.filter((group) => group.enabled).length
      * report.scenarios.length * report.settings.repeats;
  const failed = report.summary?.failedRuns
    ?? report.results.filter((result) =>
      result.status === 'failed' || result.ok === false
    ).length;
  const completed = report.summary?.completedRuns ?? report.results.length;
  const captured =
    report.results.filter((result) => result.screenshotDataUrl).length;

  return (
    <main className='publishedReportPage'>
      <div className='publishedReportContent' ref={props.contentRef}>
        <header className='publishedReportHero'>
          <div className='publishedReportShareBar' data-report-image-exclude>
            <a href='#/bench'>← Bench</a>
            <div className='publishedReportShareActions'>{props.actions}</div>
          </div>
          <div className='publishedReportEyebrow'>
            GENUI · HISTORICAL BENCH RECORD
          </div>
          <div className='publishedReportTitleRow'>
            <h1>Bench report</h1>
            <span
              className='publishedReportStatus'
              data-status={report.status ?? 'complete'}
            >
              {report.status ?? 'complete'}
            </span>
          </div>
          <p className='publishedReportDescription'>
            {report.groups.length} comparison groups · {report.scenarios.length}
            {' '}
            scenarios · {report.settings.repeats} repeats
          </p>
          <p className='publishedReportRecordDate'>
            <time dateTime={report.completedAt ?? report.createdAt}>
              {new Date(report.completedAt ?? report.createdAt).toLocaleString(
                'en-US',
              )}
            </time>
            <span>{report.jobId}</span>
          </p>
          <p className='publishedReportShareNote'>
            Read-only report. No model requests or benchmark runs are started by
            this page. Data and screenshots come only from history saved in this
            browser.
          </p>
        </header>

        <section
          className='publishedReportSection'
          aria-labelledby='published-report-overview'
        >
          <h2 id='published-report-overview'>
            <span>01</span> Overview
          </h2>
          <dl className='publishedReportStats'>
            <div>
              <dt>Planned runs</dt>
              <dd>{formatNumber(total)}</dd>
            </div>
            <div>
              <dt>Finished runs</dt>
              <dd>{formatNumber(completed)}</dd>
            </div>
            <div>
              <dt>Failed runs</dt>
              <dd>{formatNumber(failed)}</dd>
            </div>
            <div>
              <dt>Success rate</dt>
              <dd>
                {report.summary && Number.isFinite(report.summary.successRate)
                  ? `${numbers.format(report.summary.successRate * 100)}%`
                  : 'Not available'}
              </dd>
            </div>
          </dl>
          <div className='publishedReportTableWrap'>
            <table className='publishedReportTable'>
              <caption>Comparison group results</caption>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Tokens</th>
                  <th>Agent</th>
                  <th>Attempts</th>
                  <th>UI Judge</th>
                  <th>GEQI</th>
                </tr>
              </thead>
              <tbody>
                {report.summaries.map((summary, index) => {
                  const group = report.groups.find((item) =>
                    item.id === summary.groupId
                  );
                  return (
                    <tr key={`${summary.groupId}-${index}`}>
                      <th scope='row'>
                        <strong>{group?.name ?? summary.groupName}</strong>
                        <small>
                          {getBenchProtocolLabel(
                            group?.protocol ?? summary.protocol,
                          )} · {group?.profile ?? summary.profile ?? 'native'}
                        </small>
                        <small>{group?.model ?? report.env.model}</small>
                      </th>
                      <td>
                        <BenchTokens
                          tokens={summary.avgTokens}
                          usage={groupBenchTokenUsage(report, summary)}
                          average
                        />
                      </td>
                      <td>{formatMs(summary.avgAgentMs)}</td>
                      <td>{formatNumber(summary.avgAttempts)}</td>
                      <td>{judgeScore(report, summary)}</td>
                      <td>
                        {report.settings.judgeEnabled
                            && report.capabilities?.judge !== 'disabled'
                            && summary.judgeRunCount
                            && Number.isFinite(summary.avgJudgeGeqiScore)
                          ? `${
                            numbers.format(summary.avgJudgeGeqiScore!)
                          } / 100`
                          : 'Not evaluated'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {report.summaries.length === 0 && (
              <p className='publishedReportEmpty'>
                No group summaries were recorded.
              </p>
            )}
          </div>
          <p className='publishedReportShareNote'>
            {report.capabilities?.renderMetrics === 'enabled'
              ? 'Render metrics were enabled for this job.'
              : 'Render metrics are unavailable for this job; zero values do not represent measured FMP, TTI, or render duration.'}
          </p>
        </section>

        <section
          className='publishedReportSection'
          aria-labelledby='published-report-plan'
        >
          <h2 id='published-report-plan'>
            <span>02</span> Recorded plan
          </h2>
          <div className='publishedReportPlan'>
            <div>
              <h3>Scenarios</h3>
              {report.scenarios.map((scenario) => (
                <details
                  open
                  key={scenario.id}
                  className='publishedReportDisclosure'
                >
                  <summary>
                    {scenario.name}
                    <span>{scenario.type}</span>
                  </summary>
                  <p>{scenario.prompt}</p>
                  <small>Action: {scenario.action || 'None'}</small>
                </details>
              ))}
            </div>
            <div>
              <h3>Comparison groups</h3>
              {report.groups.map((group) => (
                <details
                  open
                  key={group.id}
                  className='publishedReportDisclosure'
                >
                  <summary>
                    {group.name}
                    <span>{group.role}</span>
                  </summary>
                  <dl className='publishedReportGroupConfig'>
                    <div>
                      <dt>Protocol</dt>
                      <dd>
                        {getBenchProtocolLabel(group.protocol)} ·{' '}
                        {group.profile}
                      </dd>
                    </div>
                    <div>
                      <dt>Model</dt>
                      <dd>{group.model}</dd>
                    </div>
                    <div>
                      <dt>Catalog</dt>
                      <dd>{group.catalog}</dd>
                    </div>
                    {group.protocol === 'lynx-xml' && (
                      <div>
                        <dt>XML fragment</dt>
                        <dd>
                          {group.enableHtmlFragment === true ? 'On' : 'Off'}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Instruction</dt>
                      <dd>
                        {group.extraInstruction || 'No extra instruction'}
                      </dd>
                    </div>
                  </dl>
                </details>
              ))}
            </div>
          </div>
          <p className='publishedReportShareNote'>
            Parallelism: {report.settings.parallelism} · Repair:{' '}
            {report.settings.repairEnabled ? 'enabled' : 'disabled'} · UI Judge:
            {' '}
            {report.settings.judgeEnabled
                && report.capabilities?.judge !== 'disabled'
              ? 'enabled'
              : 'disabled'}
          </p>
        </section>

        <section
          className='publishedReportSection'
          aria-labelledby='published-report-results'
        >
          <div className='publishedReportSectionHeading'>
            <h2 id='published-report-results'>
              <span>03</span> Run evidence
            </h2>
            <Button
              iconBefore={Maximize2}
              data-report-image-exclude
              size='sm'
              onClick={() => setScreenshotsOpen(true)}
              disabled={captured === 0}
            >
              View screenshots ({captured})
            </Button>
          </div>
          {captured > 0
            ? (
              <div className='publishedReportScreenshots'>
                {report.results.map((result, index) =>
                  result.screenshotDataUrl
                    ? (
                      <figure key={`${result.id}-${index}`}>
                        <img
                          src={result.screenshotDataUrl}
                          alt={`${result.groupName} · ${result.scenarioName} · #${
                            result.repeatIndex ?? 1
                          }`}
                          loading='lazy'
                        />
                        <figcaption>
                          <strong>{result.scenarioName}</strong>
                          <span>
                            {result.groupName} · #{result.repeatIndex ?? 1}
                          </span>
                        </figcaption>
                      </figure>
                    )
                    : null
                )}
              </div>
            )
            : (
              <p className='publishedReportEmpty'>
                No screenshots were saved with this report.
              </p>
            )}
          {report.results.length === 0 && (
            <p className='publishedReportEmpty'>
              No run results were recorded.
            </p>
          )}
          {report.results.map((result, index) => (
            <details
              open
              className='publishedReportDisclosure'
              key={`${result.id}-${index}`}
            >
              <summary>
                <strong>{result.scenarioName}</strong>
                <span>{result.groupName} · #{result.repeatIndex ?? 1}</span>
                <span
                  className='publishedReportRunStatus'
                  data-failed={result.status === 'failed'
                    || result.ok === false}
                >
                  {result.status === 'failed' || result.ok === false
                    ? 'Failed'
                    : (result.status === 'complete' || result.ok === true
                      ? 'Complete'
                      : 'Not recorded')}
                </span>
              </summary>
              <div className='benchRunTokenMetrics'>
                <BenchTokens
                  tokens={result.tokens}
                  usage={readBenchTokenUsage(result.usage)}
                />
                <span>
                  tokens · {formatMs(result.agentMs)} Agent ·{' '}
                  {formatNumber(result.attempts)} attempts
                </span>
              </div>
              <p>
                UI Judge: {result.judgeStatus === 'complete'
                    && Number.isFinite(result.judgeScore)
                  ? `${numbers.format(result.judgeScore)} / 5`
                  : result.judgeStatus ?? 'not evaluated'}
              </p>
              {[
                ...new Set([
                  ...(result.errors ?? []),
                  ...(result.judgeWarnings ?? []),
                  ...(result.error ? [result.error] : []),
                ]),
              ].map((error) => (
                <p key={error} className='publishedReportDiagnostic'>{error}</p>
              ))}
            </details>
          ))}
          {(report.warnings?.length ?? 0) > 0 && (
            <div className='publishedReportWarnings'>
              <h3>Report warnings</h3>
              <ul>
                {report.warnings?.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
      {screenshotsOpen && captured > 0 && (
        <BenchScreenshotsDialog
          open
          onClose={() => setScreenshotsOpen(false)}
          report={report}
          settings={report.settings}
        />
      )}
    </main>
  );
}
