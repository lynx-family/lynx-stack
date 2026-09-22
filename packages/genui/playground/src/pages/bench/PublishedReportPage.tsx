// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useMemo } from 'react';
import type { ReactNode, Ref } from 'react';

import { BenchArtifactCopyButton } from './BenchArtifactCopyButton.js';
import { BenchCost, BenchCostLabel } from './BenchCost.js';
import { getBenchProtocolLabel } from './benchData.js';
import {
  benchGroupAverageCost,
  benchResultCost,
  benchTotalCost,
} from './benchPricing.js';
import type {
  BenchGroupSummary,
  BenchReport,
  BenchResult,
} from './benchReportTypes.js';
import { createBenchScreenshotReader } from './benchScreenshot.js';
import { BenchTaskTiming } from './BenchTaskTiming.js';
import { BenchTokens } from './BenchTokens.js';
import {
  groupBenchTokenUsage,
  readBenchTokenUsage,
} from './benchTokenUsage.js';
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
  const screenshotGroups = useMemo(() => {
    const groups = new Map(report.groups.map((group) => [group.id, {
      id: group.id,
      name: group.name,
      results: [] as BenchResult[],
    }]));
    for (const result of report.results) {
      if (!result.screenshotDataUrl) continue;
      let group = groups.get(result.groupId);
      if (!group) {
        group = { id: result.groupId, name: result.groupName, results: [] };
        groups.set(result.groupId, group);
      }
      group.results.push(result);
    }
    const scenarios = new Map(
      report.scenarios.map((scenario, index) => [scenario.id, index]),
    );
    for (const result of report.results) {
      if (!scenarios.has(result.scenarioId)) {
        scenarios.set(result.scenarioId, scenarios.size);
      }
    }
    return [...groups.values()].filter((group) => group.results.length > 0).map(
      (group) => ({
        ...group,
        results: group.results.sort((left, right) =>
          scenarios.get(left.scenarioId)! - scenarios.get(right.scenarioId)!
          || (left.repeatIndex ?? 1) - (right.repeatIndex ?? 1)
        ),
      }),
    );
  }, [report]);
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
            <span>{report.jobId}</span>
          </p>
          <BenchTaskTiming
            startedAt={report.startedAt}
            completedAt={report.completedAt}
            durationMs={report.durationMs}
          />
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
              <dt>
                <BenchCostLabel>Estimated cost (CNY)</BenchCostLabel>
              </dt>
              <dd>
                <BenchCost cost={benchTotalCost(report.results)} />
              </dd>
            </div>
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
                  <th>
                    <BenchCostLabel>Est. cost (CNY)</BenchCostLabel>
                  </th>
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
                      <td>
                        <BenchCost
                          cost={benchGroupAverageCost(report, summary)}
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
                        <dt>StylePreset</dt>
                        <dd>
                          {group.stylePreset === 'default'
                            ? 'On'
                            : 'Off'}
                        </dd>
                      </div>
                    )}
                    {group.protocol === 'lynx-xml' && (
                      <div>
                        <dt>Template</dt>
                        <dd>
                          {group.enableHtmlFragment === true ? 'On' : 'Off'}
                        </dd>
                      </div>
                    )}
                    {group.protocol === 'lynx-xml' && (
                      <div>
                        <dt>ScriptReuse</dt>
                        <dd>
                          {group.enableScriptReuse === true ? 'On' : 'Off'}
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
            Repair: {report.settings.repairEnabled ? 'enabled' : 'disabled'}
            {' '}
            · UI Judge: {report.settings.judgeEnabled
                && report.capabilities?.judge !== 'disabled'
              ? 'enabled'
              : 'disabled'}
          </p>
        </section>

        <section
          className='publishedReportSection'
          aria-labelledby='published-report-results'
        >
          <h2 id='published-report-results'>
            <span>03</span> Run evidence
          </h2>
          {captured > 0
            ? (
              screenshotGroups.map((group) => (
                <section
                  className='publishedReportScreenshotGroup'
                  key={group.id}
                  aria-label={`${group.name} screenshots`}
                >
                  <h3>
                    {group.name}
                    <span>{group.results.length} screenshots</span>
                  </h3>
                  <div className='publishedReportScreenshots'>
                    {group.results.map((result, index) => (
                      <figure key={`${result.id}-${index}`}>
                        <img
                          src={result.screenshotDataUrl}
                          alt={`${group.name} · ${result.scenarioName} · #${
                            result.repeatIndex ?? 1
                          }`}
                          loading='lazy'
                        />
                        <figcaption>
                          <strong>{result.scenarioName}</strong>
                          <span>#{result.repeatIndex ?? 1}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              ))
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
              className='publishedReportDisclosure'
              data-report-image-exclude
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
                <BenchArtifactCopyButton result={result} />
              </summary>
              <div className='benchRunTokenMetrics'>
                <BenchTokens
                  tokens={result.tokens}
                  usage={readBenchTokenUsage(result.usage)}
                />
                <span>
                  · <BenchCostLabel>Est. cost</BenchCostLabel>{' '}
                  <BenchCost cost={benchResultCost(result)} />
                </span>
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
    </main>
  );
}
