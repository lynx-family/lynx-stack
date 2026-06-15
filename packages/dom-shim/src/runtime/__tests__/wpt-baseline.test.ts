// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSubset } from '../../../wpt/run.ts';
import { resetPapi } from '../../../wpt/test-papi.ts';
import { resolveTest } from '../../../wpt/tests.ts';
import { _resetDocumentForTesting, document } from '../document.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = resolve(__dirname, '../../../wpt/baseline.json');
const DASHBOARD_PATH = resolve(
  __dirname,
  '../../../wpt/dashboard-data.json',
);

interface RunResultLike {
  overallPassRate: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  totalTests: number;
  gateThreshold: number;
  directories: Array<{
    path: string;
    passed: number;
    failed: number;
    errored: number;
    skipped: number;
    passRate: number;
    tests: Array<{
      directory: string;
      name: string;
      status: string;
      message?: string;
      diagnostics: string[];
    }>;
  }>;
}

function deriveDashboard(result: RunResultLike): Record<string, unknown> {
  return {
    schemaVersion: '1',
    generatedAt: new Date().toISOString(),
    overall: {
      totalTests: result.totalTests,
      passed: result.passed,
      failed: result.failed,
      errored: result.errored,
      skipped: result.skipped,
      passRate: result.overallPassRate,
      gateThreshold: result.gateThreshold,
      gateMet: result.overallPassRate >= result.gateThreshold,
    },
    directories: result.directories.map((d) => {
      const failureReasons = new Map<string, number>();
      for (const t of d.tests) {
        if (t.status === 'fail' || t.status === 'error') {
          const reason = (t.message ?? '<no message>').split('\n')[0]!;
          failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
        }
      }
      const top5 = [...failureReasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));
      return {
        path: d.path,
        totalTests: d.tests.length,
        passed: d.passed,
        failed: d.failed,
        errored: d.errored,
        skipped: d.skipped,
        passRate: d.passRate,
        topFailureReasons: top5,
      };
    }),
  };
}

const SUBSET = {
  schemaVersion: '1',
  gateThreshold: 0.7,
  directories: [
    {
      path: 'dom/nodes/read',
      tests: [
        'Node-tagName',
        'Node-nodeName',
        'Node-nodeType',
        'Node-nodeValue',
        'Node-parentNode',
        'Node-childNodes',
        'Node-firstChild',
        'Node-lastChild',
        'Node-nextSibling',
        'Node-previousSibling',
        'Node-hasChildNodes',
        'Node-isEqualNode',
        'Node-isSameNode',
        'Node-isConnected',
        'Node-contains',
        'Node-getRootNode',
        'Node-compareDocumentPosition',
        'Element-tagName',
        'Element-localName',
        'Element-id',
        'Element-children',
        'Element-firstElementChild',
        'Element-lastElementChild',
        'Element-childElementCount',
        'Element-nextElementSibling',
        'Element-previousElementSibling',
      ],
    },
    {
      path: 'dom/nodes/write',
      tests: [
        'Element-setAttribute',
        'Element-removeAttribute',
        'Element-toggleAttribute',
        'Element-classList',
        'Element-className',
        'Element-appendChild',
        'Element-removeChild',
        'Element-insertBefore',
        'Element-replaceChild',
        'Element-cloneNode',
        'ChildNode-remove',
        'ChildNode-replaceWith',
        'ChildNode-before',
        'ChildNode-after',
        'ParentNode-append',
        'ParentNode-prepend',
      ],
    },
    {
      path: 'dom/events',
      tests: [
        'EventTarget-addEventListener',
        'EventTarget-removeEventListener',
        'Event-dispatchEvent',
        'Event-preventDefault',
        'Event-stopPropagation',
        'Event-stopImmediatePropagation',
        'Event-capture-bubble',
        'Event-target-currentTarget',
        'Event-once-option',
        'Event-signal-option',
      ],
    },
    {
      path: 'dom/lists',
      tests: [
        'DOMTokenList-add',
        'DOMTokenList-remove',
        'DOMTokenList-toggle',
        'DOMTokenList-replace',
        'DOMTokenList-contains',
        'DOMTokenList-iteration',
        'DOMTokenList-length-item',
      ],
    },
    {
      path: 'dom/abort',
      tests: ['abort-signal-addEventListener', 'abort-signal-once-listener'],
    },
    {
      path: 'html/dom/innerhtml',
      tests: [
        'Element-innerHTML-basic',
        'Element-innerHTML-getter',
        'Element-innerHTML-script-skip',
        'Element-outerHTML',
        'Element-insertAdjacentHTML',
        'Element-insertAdjacentText',
      ],
    },
    {
      path: 'html/dom/global-attributes',
      tests: [
        'dataset',
        'data-attribute-roundtrip',
        'class-attribute',
        'id-attribute',
        'style-attribute',
      ],
    },
    {
      path: 'css/cssom',
      tests: [
        'cssom-setProperty',
        'cssom-getPropertyValue',
        'cssom-removeProperty',
        'cssom-cssText',
        'cssom-cssText-set',
        'cssom-camelCase-accessor',
        'cssom-css-custom-property',
      ],
    },
    {
      path: 'selectors',
      tests: [
        'querySelector-id',
        'querySelector-class',
        'querySelector-tag',
        'querySelector-compound',
        'querySelectorAll-multiple',
        'matches-basic',
        'closest-walks-ancestors',
      ],
    },
  ],
};

describe('US-463 WPT baseline generation (in-test)', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    _resetDocumentForTesting();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
    _resetDocumentForTesting();
  });

  it('runs the full subset and reports a pass rate ≥ gate threshold', async () => {
    const result = await runSubset({
      subset: SUBSET,
      resolveTest,
      beforeEachTest: () => {
        _resetSchedulerForTesting();
        _resetDocumentForTesting();
        resetPapi();
        void document.body;
      },
    });
    expect(result.totalTests).toBe(86);
    expect(result.gateThreshold).toBe(0.7);
    expect(result.overallPassRate).toBeGreaterThanOrEqual(0.7);

    // When WPT_UPDATE_BASELINE=1, write the result to wpt/baseline.json so
    // CI can pin the current known-good state. Default mode just runs the
    // assertions above. Also writes the derived dashboard-data.json
    // (US-466) so the dashboard site can render without re-running the
    // suite.
    if (process.env['WPT_UPDATE_BASELINE'] === '1') {
      writeFileSync(
        BASELINE_PATH,
        `${JSON.stringify(result, null, 2)}\n`,
        'utf8',
      );
      writeFileSync(
        DASHBOARD_PATH,
        `${JSON.stringify(deriveDashboard(result), null, 2)}\n`,
        'utf8',
      );
    }
  });

  it('reports per-directory pass rates and tests', async () => {
    const result = await runSubset({
      subset: SUBSET,
      resolveTest,
      beforeEachTest: () => {
        _resetSchedulerForTesting();
        _resetDocumentForTesting();
        resetPapi();
        void document.body;
      },
    });
    for (const d of result.directories) {
      expect(d.tests.length).toBeGreaterThan(0);
      expect(d.passRate).toBeGreaterThanOrEqual(0);
      expect(d.passRate).toBeLessThanOrEqual(1);
    }
  });
});
