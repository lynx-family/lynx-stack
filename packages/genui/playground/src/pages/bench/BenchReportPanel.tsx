// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useMemo } from 'react';

import { findComparableBaseline } from './benchData.js';
import type { BenchSettings } from './benchData.js';
import type { BenchGroupSummary, BenchReport } from './benchReportTypes.js';
import { Button } from '../../components/Button.js';
import { Copy, Maximize2, Sparkles } from '../../components/Icon.js';
import { PageHeader } from '../../components/PageHeader.js';

function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function deltaText(value: number, baseline: number): string {
  if (baseline === 0) return 'n/a';
  const delta = ((value - baseline) / baseline) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

function getReportSubtitle(
  report: BenchReport | null,
  reportIsStale: boolean,
): string {
  if (!report) return 'No report yet';
  if (reportIsStale) return 'Plan changed · Showing the previous report';
  return new Date(report.createdAt).toLocaleString('en-US');
}

function formatSummaryJudgeMetric(
  report: BenchReport,
  settings: BenchSettings,
  summary: BenchGroupSummary,
): string {
  if (!settings.judgeEnabled || report.capabilities?.judge === 'disabled') {
    return 'off';
  }
  if (summary.judgeRunCount === 0) return 'n/a';
  const visual = `${summary.avgJudgeScore.toFixed(1)}/5`;
  return summary.avgJudgeGeqiScore === undefined
    ? visual
    : `${visual} · ${summary.avgJudgeGeqiScore.toFixed(1)}/100 GEQI`;
}

function getScreenshotSummary(
  report: BenchReport,
  settings: BenchSettings,
) {
  const groupCount = report.groups.length > 0
    ? report.groups.length
    : new Set(report.results.map((result) => result.groupId)).size;
  const scenarioCount = report.scenarios.length > 0
    ? report.scenarios.length
    : new Set(report.results.map((result) => result.scenarioId)).size;
  const total = groupCount * scenarioCount * Math.max(1, settings.repeats);
  const captured =
    report.results.filter((result) => Boolean(result.screenshotDataUrl)).length;
  const failed = report.results.filter((result) =>
    !result.screenshotDataUrl
    && (result.status === 'failed' || result.ok === false)
  ).length;
  return {
    captured,
    failed,
    missing: Math.max(0, total - captured - failed),
    total,
  };
}

export function BenchReportPanel(props: {
  copyState: 'copied' | 'idle';
  onCopy: () => Promise<void> | void;
  onOpenScreenshots: () => void;
  report: BenchReport | null;
  reportIsStale: boolean;
  settings: BenchSettings;
}) {
  const summaryBaselines = useMemo(() => {
    const baselines = new Map<string, BenchGroupSummary>();
    if (!props.report) return baselines;
    for (const summary of props.report.summaries) {
      const group = props.report.groups.find((item) =>
        item.id === summary.groupId
      );
      const baselineGroup = group
        ? findComparableBaseline(group, props.report.groups)
        : undefined;
      const baselineSummary = props.report.summaries.find((item) =>
        item.groupId === baselineGroup?.id
      ) ?? props.report.summaries.find((item) =>
        item.role === 'control'
      )
        ?? summary;
      baselines.set(summary.groupId, baselineSummary);
    }
    return baselines;
  }, [props.report]);
  const bestTokens = props.report
    ? [...props.report.summaries].sort(
      (left, right) => left.avgTokens - right.avgTokens,
    )[0] ?? null
    : null;
  const fastestAgent = props.report
    ? [...props.report.summaries].sort(
      (left, right) => left.avgAgentMs - right.avgAgentMs,
    )[0] ?? null
    : null;
  const topJudge = props.report?.capabilities?.judge === 'disabled'
    ? null
    : [...(props.report?.summaries ?? [])].filter((item) =>
      item.judgeRunCount === undefined || item.judgeRunCount > 0
    ).sort((left, right) => right.avgJudgeScore - left.avgJudgeScore)[0]
      ?? null;
  const groupsById = new Map(
    props.report?.groups.map((group) => [group.id, group]) ?? [],
  );
  const getGroupName = (summary: BenchGroupSummary | null) => {
    if (!summary) return 'n/a';
    const group = groupsById.get(summary.groupId);
    return group ? group.name : summary.groupName;
  };
  const screenshotSummary = props.report
    ? getScreenshotSummary(props.report, props.settings)
    : null;

  return (
    <aside className='benchReportPane' aria-label='Bench Report'>
      <PageHeader
        className='benchReportHeader'
        titleClassName='benchSectionTitle'
        descriptionClassName='benchSectionSub'
        title='Report'
        description={getReportSubtitle(props.report, props.reportIsStale)}
        topContent={
          <div className='benchReportActions'>
            <Button
              variant='secondary'
              size='sm'
              iconBefore={Copy}
              disabled={!props.report}
              onClick={() => void props.onCopy()}
            >
              {props.copyState === 'copied' ? 'Copied' : 'JSON'}
            </Button>
          </div>
        }
      />

      {props.report && props.report.summaries.length > 0 && screenshotSummary
        ? (
          <>
            <div className='benchInsightGrid'>
              <div className='benchInsight'>
                <span>Lowest tokens</span>
                <strong>{getGroupName(bestTokens)}</strong>
                <small>
                  {bestTokens ? formatNumber(bestTokens.avgTokens) : 'n/a'}
                </small>
              </div>
              <div className='benchInsight'>
                <span>Fastest agent</span>
                <strong>{getGroupName(fastestAgent)}</strong>
                <small>
                  {fastestAgent ? formatMs(fastestAgent.avgAgentMs) : 'n/a'}
                </small>
              </div>
              <div className='benchInsight'>
                <span>Best judge score</span>
                <strong>{getGroupName(topJudge)}</strong>
                <small>
                  {topJudge ? `${topJudge.avgJudgeScore.toFixed(1)}/5` : 'n/a'}
                </small>
              </div>
            </div>

            <div className='benchReportTableWrap'>
              <table className='benchReportTable'>
                <thead>
                  <tr>
                    <th>Comparison group</th>
                    <th>Tokens</th>
                    <th>Agent</th>
                    <th>FMP</th>
                    <th>TTI</th>
                    <th>Render</th>
                    <th>Attempts</th>
                    <th>Judge</th>
                  </tr>
                </thead>
                <tbody>
                  {props.report.summaries.map((summary) => {
                    const baseline = summaryBaselines.get(summary.groupId)
                      ?? summary;
                    return (
                      <tr key={summary.groupId}>
                        <td>
                          <div className='benchTableGroup'>
                            <span className={`benchRoleDot ${summary.role}`} />
                            <span>
                              {getGroupName(summary)}
                              <small>
                                {summary.protocol === 'openui'
                                  ? 'OpenUI'
                                  : 'A2UI'}
                                {summary.profile ? ` · ${summary.profile}` : ''}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong>{formatNumber(summary.avgTokens)}</strong>
                          <small>
                            {deltaText(summary.avgTokens, baseline.avgTokens)}
                          </small>
                        </td>
                        <td>
                          <strong>{formatMs(summary.avgAgentMs)}</strong>
                          <small>
                            {deltaText(summary.avgAgentMs, baseline.avgAgentMs)}
                          </small>
                        </td>
                        <td>{formatMs(summary.avgFmpMs)}</td>
                        <td>{formatMs(summary.avgTtiMs)}</td>
                        <td>{formatMs(summary.avgRenderMs)}</td>
                        <td>{summary.avgAttempts.toFixed(1)}x</td>
                        <td>
                          {formatSummaryJudgeMetric(
                            props.report,
                            props.settings,
                            summary,
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <section className='benchScreenshotSection'>
              <div className='benchSectionHeader'>
                <div>
                  <h3 className='benchSectionTitle'>Run screenshots</h3>
                  <p className='benchSectionSub'>
                    Actual render screenshots for every run, including failed
                    slots
                  </p>
                </div>
                <Button
                  variant='secondary'
                  size='sm'
                  iconBefore={Maximize2}
                  disabled={screenshotSummary.total === 0}
                  onClick={props.onOpenScreenshots}
                >
                  View screenshots
                </Button>
              </div>
              <div className='benchScreenshotSummaryGrid'>
                <div>
                  <span>Runs</span>
                  <strong>{formatNumber(screenshotSummary.total)}</strong>
                </div>
                <div>
                  <span>Captured</span>
                  <strong>{formatNumber(screenshotSummary.captured)}</strong>
                </div>
                <div>
                  <span>Failed</span>
                  <strong>{formatNumber(screenshotSummary.failed)}</strong>
                </div>
                <div>
                  <span>Missing</span>
                  <strong>{formatNumber(screenshotSummary.missing)}</strong>
                </div>
              </div>
            </section>

            <div className='benchReportNotes'>
              <span>
                Agent, token, attempts, and validation data are collected by the
                server. Unavailable Render or UI Judge data is explicitly
                marked.
              </span>
            </div>
            {props.report.warnings && props.report.warnings.length > 0
              ? (
                <div className='benchReportWarnings'>
                  {props.report.warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              )
              : null}
          </>
        )
        : (
          <div className='benchEmptyReport'>
            <Sparkles size={28} strokeWidth={1.8} />
            <strong>Waiting for Bench data</strong>
            <span>Run the current plan to generate a unified report here.</span>
          </div>
        )}
    </aside>
  );
}
