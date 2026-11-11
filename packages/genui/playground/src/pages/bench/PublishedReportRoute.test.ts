// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
/* eslint-disable n/no-unsupported-features/node-builtins -- Tests use browser APIs in jsdom. */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import 'fake-indexeddb/auto';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import {
  DEFAULT_BENCH_SCENARIOS,
  DEFAULT_BENCH_SETTINGS,
  createDefaultBenchGroups,
} from './benchData.js';
import * as reportImage from './benchReportImage.js';
import { loadPublishedReport } from './publishedReportLoader.js';
import { PublishedReportRoute } from './PublishedReportRoute.js';
import {
  LEGACY_BENCH_HISTORY_KEY as BENCH_HISTORY_STORAGE_KEY,
  BENCH_SELECTED_REPORT_STORAGE_KEY,
  readBenchHistory,
  selectBenchReport,
} from '../../storage/benchRepo.js';
import { getDB } from '../../storage/db.js';
import * as clipboard from '../../utils/clipboard.js';

const JOB_ID = '059a758e-4cbf-4053-bbe4-9f8cb47f7444';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';

function historyEntry(id: string, report = reportFixture()) {
  return {
    id,
    title: id,
    savedAt: report.createdAt,
    report,
    config: {
      env: { ...report.env, apiKeyConfigured: false },
      settings: report.settings,
      groups: report.groups,
      scenarios: report.scenarios,
    },
  };
}

function reportFixture() {
  return {
    id: 'saved-report',
    jobId: JOB_ID,
    createdAt: '2026-09-07T09:36:28.049Z',
    env: { model: 'saved-model' },
    settings: { ...DEFAULT_BENCH_SETTINGS, repeats: 1 },
    groups: createDefaultBenchGroups('saved-model'),
    scenarios: DEFAULT_BENCH_SCENARIOS,
    results: [{
      id: 'weather-run',
      groupId: 'control-empty',
      groupName: 'Baseline',
      scenarioId: 'weather-refresh',
      scenarioName: 'Weather Refresh Card',
      repeatIndex: 1,
      screenshotDataUrl: PNG,
    }],
    summaries: [],
    summary: { totalRuns: 3, completedRuns: 1, failedRuns: 0, successRate: 1 },
  };
}

describe('local-only report routing', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetch: ReturnType<typeof rstest.fn>;

  beforeEach(async () => {
    const db = await getDB();
    await db.clear('benchHistory');
    await db.clear('meta');
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/#/bench/reports');
    rstest.stubGlobal('React', React);
    rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    fetch = rstest.fn();
    rstest.stubGlobal('fetch', fetch);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function(this: HTMLDialogElement) {
        this.open = false;
      },
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await React.act(async () => root.unmount());
    container.remove();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    rstest.restoreAllMocks();
    rstest.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  async function mount(reportId = '') {
    await React.act(async () =>
      root.render(
        React.createElement(PublishedReportRoute, { reportId }),
      )
    );
    await rstest.waitFor(async () => {
      await React.act(async () => {
        await loadPublishedReport(reportId).catch(() => undefined);
      });
      expect(container.textContent).not.toContain('Loading saved report…');
      expect(container.querySelector('.publishedReportContent, [role="alert"]'))
        .not.toBeNull();
    });
  }

  async function click(label: string) {
    const button = [...container.querySelectorAll('button')].find((item) =>
      item.textContent === label
    );
    expect(button).toBeDefined();
    await React.act(async () => button!.click());
  }

  test.each([
    {
      protocol: 'a2ui',
      messages: [{
        updateDataModel: { surfaceId: 'main', value: { text: 'Saved output' } },
      }],
      text: 'Raw assistant response',
      expected: JSON.stringify(
        [{
          updateDataModel: {
            surfaceId: 'main',
            value: { text: 'Saved output' },
          },
        }],
        null,
        2,
      ),
    },
    {
      protocol: 'a2ui',
      messages: [],
      text: 'Incomplete output from a failed run',
      expected: 'Incomplete output from a failed run',
    },
    {
      protocol: 'openui',
      messages: [{ unrelated: true }],
      text: 'root = Card(Text("Saved output"))\n',
      expected: 'root = Card(Text("Saved output"))\n',
    },
    {
      protocol: 'lynx-xml',
      text: '<!doctype lynx>\n<lynx engine-version="4.2"></lynx>\n',
      expected: '<!doctype lynx>\n<lynx engine-version="4.2"></lynx>\n',
    },
    {
      protocol: 'html',
      text: '<!doctype html>\n<html><body>Saved output</body></html>\n',
      expected: '<!doctype html>\n<html><body>Saved output</body></html>\n',
    },
    {
      protocol: undefined,
      messages: [{ updateDataModel: { surfaceId: 'main', value: {} } }],
      expected: JSON.stringify(
        [{ updateDataModel: { surfaceId: 'main', value: {} } }],
        null,
        2,
      ),
    },
  ])(
    'copies the saved $protocol artifact from its own collapsed run',
    async (artifact) => {
      const fixture = reportFixture();
      const report = {
        ...fixture,
        results: [
          {
            ...fixture.results[0]!,
            protocol: artifact.protocol,
            text: artifact.text,
            messages: artifact.messages,
          },
          {
            ...fixture.results[0]!,
            id: 'second-run',
            repeatIndex: 2,
            protocol: 'html',
            text: '<!doctype html><html>Second artifact</html>',
          },
        ],
      };
      window.localStorage.setItem(
        BENCH_HISTORY_STORAGE_KEY,
        JSON.stringify([historyEntry('local-entry', report)]),
      );
      const copy = rstest.spyOn(clipboard, 'copyToClipboard').mockResolvedValue(
        true,
      );
      await mount(JOB_ID);
      const buttons = container.querySelectorAll<HTMLButtonElement>(
        '.publishedReportArtifactAction button',
      );
      expect(buttons).toHaveLength(2);
      const disclosure = buttons[0]!.closest('details')!;
      expect(disclosure.open).toBe(false);
      await React.act(async () => buttons[0]!.click());
      expect(copy).toHaveBeenLastCalledWith(artifact.expected);
      expect(disclosure.open).toBe(false);
      expect(disclosure.querySelector('[role="status"]')?.textContent).toBe(
        'Copied.',
      );
      await React.act(async () => buttons[1]!.click());
      expect(copy).toHaveBeenLastCalledWith(report.results[1]!.text);
      expect(copy).toHaveBeenCalledTimes(2);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test('disables artifact copy when an older run has no saved output', async () => {
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify([historyEntry('local-entry')]),
    );
    const copy = rstest.spyOn(clipboard, 'copyToClipboard');
    await mount(JOB_ID);
    const button = container.querySelector<HTMLButtonElement>(
      '.publishedReportArtifactAction button',
    )!;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('No artifact was saved for this run.');
    await React.act(async () => button.click());
    expect(copy).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('allows retrying an artifact copy after clipboard failure', async () => {
    const fixture = reportFixture();
    const report = {
      ...fixture,
      results: [{
        ...fixture.results[0]!,
        protocol: 'html',
        text: '<!doctype html><html>Saved output</html>',
      }],
    };
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify([historyEntry('local-entry', report)]),
    );
    const copy = rstest.spyOn(clipboard, 'copyToClipboard')
      .mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await mount(JOB_ID);
    await click('Copy artifact');
    expect(
      container.querySelector('.publishedReportArtifactAction [role="status"]')
        ?.textContent,
    )
      .toContain('Copy failed');
    await click('Copy artifact');
    expect(
      container.querySelector('.publishedReportArtifactAction [role="status"]')
        ?.textContent,
    )
      .toBe('Copied.');
    expect(copy).toHaveBeenCalledTimes(2);
  });

  test('reads the selected cached record and its screenshot without a data URL or network request', async () => {
    const raw = JSON.stringify([historyEntry('local-entry')]);
    window.localStorage.setItem(BENCH_HISTORY_STORAGE_KEY, raw);
    window.localStorage.setItem(
      BENCH_SELECTED_REPORT_STORAGE_KEY,
      'local-entry',
    );
    await mount();
    expect(container.textContent).toContain('Weather Refresh Card');
    expect(container.querySelector('img')?.getAttribute('src')).toBe(PNG);
    expect(container.textContent).not.toContain('Share report');
    expect(container.textContent).not.toContain('Copy report link');
    expect(fetch).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/bench/reports');
    expect(window.location.search).toBe('');
    expect(window.localStorage.getItem(BENCH_HISTORY_STORAGE_KEY)).toBeNull();
    const saved = await readBenchHistory();
    expect(saved[0]?.report?.results[0]?.screenshotDataUrl)
      .toBe(PNG);
  });

  test('generates, previews and downloads a local PNG while retaining JSON copy', async () => {
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify([historyEntry('local-entry')]),
    );
    const blob = new Blob(['PNG'], { type: 'image/png' });
    const capture = rstest.spyOn(reportImage, 'createBenchReportImage')
      .mockResolvedValue(blob);
    const copy = rstest.spyOn(clipboard, 'copyToClipboard').mockResolvedValue(
      true,
    );
    const createUrl = rstest.fn(() => 'blob:report-image');
    const revokeUrl = rstest.fn();
    rstest.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createUrl;
        static revokeObjectURL = revokeUrl;
      },
    );
    let downloaded: HTMLAnchorElement | undefined;
    rstest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function(this: HTMLAnchorElement) {
        downloaded = this;
      },
    );
    await mount(JOB_ID);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(PNG);
    await click('Copy Report JSON');
    expect(copy).toHaveBeenCalledWith(expect.stringContaining(PNG));
    expect(container.textContent).toContain('JSON copied.');
    await click('Generate share image');
    expect(capture).toHaveBeenCalledWith(
      container.querySelector('.publishedReportContent'),
    );
    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(container.querySelector('dialog')?.open).toBe(true);
    expect(container.querySelector('dialog img')?.getAttribute('src')).toBe(
      'blob:report-image',
    );
    await click('Download PNG');
    expect(downloaded?.download).toBe('bench-report.png');
    expect(downloaded?.href).toBe('blob:report-image');
    await click('Close');
    expect(container.querySelector('dialog')?.open).toBe(false);
    expect(revokeUrl).toHaveBeenCalledWith('blob:report-image');
    expect(fetch).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(BENCH_HISTORY_STORAGE_KEY)).toBeNull();
    const saved = await readBenchHistory();
    expect(saved[0]?.report?.results[0]?.screenshotDataUrl)
      .toBe(PNG);
    expect(window.location.hash).toBe('#/bench/reports');
    expect(window.location.search).toBe('');
  });

  test('supports copying PNGs and keeps download available when clipboard access fails', async () => {
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify([historyEntry('local-entry')]),
    );
    const blob = new Blob(['PNG'], { type: 'image/png' });
    rstest.spyOn(reportImage, 'createBenchReportImage').mockResolvedValue(blob);
    rstest.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = () => 'blob:report-image';
        static revokeObjectURL = rstest.fn();
      },
    );
    const write = rstest.fn().mockResolvedValue(undefined);
    rstest.stubGlobal('navigator', { clipboard: { write } });
    rstest.stubGlobal(
      'ClipboardItem',
      class {
        constructor(readonly data: Record<string, Blob>) {}
      },
    );
    await mount(JOB_ID);
    await click('Generate share image');
    await click('Copy image');
    expect(write).toHaveBeenCalledWith([
      expect.objectContaining({ data: { 'image/png': blob } }),
    ]);
    expect(container.textContent).toContain('Image copied.');
    write.mockRejectedValue(new Error('Denied'));
    await click('Copy image');
    expect(container.textContent).toContain('Use Download PNG instead.');
    expect(container.textContent).toContain('Download PNG');
  });

  test('shows capture errors and lets the user retry, cancel, and ignore a late result', async () => {
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify([historyEntry('local-entry')]),
    );
    const capture = rstest.spyOn(reportImage, 'createBenchReportImage')
      .mockRejectedValueOnce(new Error('Screenshot decode failed'));
    const createUrl = rstest.fn();
    rstest.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createUrl;
        static revokeObjectURL = rstest.fn();
      },
    );
    await mount(JOB_ID);
    await click('Generate share image');
    expect(container.querySelector('dialog [role="alert"]')?.textContent).toBe(
      'Screenshot decode failed',
    );
    let resolve!: (blob: Blob) => void;
    capture.mockImplementationOnce(() =>
      new Promise((done) => {
        resolve = done;
      })
    );
    await click('Try again');
    expect(container.textContent).toContain('Generating PNG…');
    React.act(() => {
      container.querySelector('dialog')!.dispatchEvent(
        new Event('cancel', { bubbles: true, cancelable: true }),
      );
    });
    await React.act(async () =>
      resolve(new Blob(['PNG'], { type: 'image/png' }))
    );
    expect(container.querySelector('dialog')?.open).toBe(false);
    expect(createUrl).not.toHaveBeenCalled();
  });

  test('keeps this tab on its own report when another tab opens a different history entry', async () => {
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify([
        historyEntry('first'),
        historyEntry('second', {
          ...reportFixture(),
          groups: createDefaultBenchGroups('second-model'),
        }),
      ]),
    );
    window.sessionStorage.setItem(BENCH_SELECTED_REPORT_STORAGE_KEY, 'first');
    window.localStorage.setItem(BENCH_SELECTED_REPORT_STORAGE_KEY, 'first');
    await mount();
    await React.act(async () => selectBenchReport('second'));
    await rstest.waitFor(async () => {
      await React.act(async () => {
        await readBenchHistory();
      });
      expect(container.textContent).toContain('saved-model');
    });
    expect(container.textContent).toContain('saved-model');
    expect(container.textContent).not.toContain('second-model');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('selects distinct entries even when their old job IDs were redacted', async () => {
    const first = { ...reportFixture(), jobId: '[redacted credential]' };
    const second = {
      ...first,
      env: { model: 'second-model' },
      groups: createDefaultBenchGroups('second-model'),
    };
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify([
        historyEntry('first', first),
        historyEntry('second', second),
      ]),
    );
    window.localStorage.setItem(BENCH_SELECTED_REPORT_STORAGE_KEY, 'second');
    await mount();
    expect(container.textContent).toContain('second-model');
    expect(container.textContent).not.toContain('saved-model');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('does not fetch a legacy shared-data parameter or substitute local history', async () => {
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify([historyEntry('local-entry')]),
    );
    window.localStorage.setItem(
      BENCH_SELECTED_REPORT_STORAGE_KEY,
      'local-entry',
    );
    window.history.replaceState(
      null,
      '',
      '/?benchReportUrl=https%3A%2F%2Fexample.test%2Freport.json#/bench/reports/shared',
    );
    await mount('shared');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Only reports saved in this browser',
    );
    expect(container.querySelector('img')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('does not use an unrelated cached report when the selection is missing', async () => {
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify([historyEntry('local-entry')]),
    );
    await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'not found',
    );
    expect(container.querySelector('img')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('shows a clear error in a browser without cached history', async () => {
    await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'not found',
    );
    expect(container.textContent).toContain(
      'Link-based sharing is not enabled',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
