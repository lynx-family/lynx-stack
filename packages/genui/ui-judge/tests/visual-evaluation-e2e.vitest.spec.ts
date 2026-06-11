// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Lynx } from '../../../testing-library/kitten-lynx/src/index.js';
import type {
  KittenLynxView,
} from '../../../testing-library/kitten-lynx/src/index.js';
import { runVisualEvaluation } from '../src/index.js';
import {
  captureReactFixtureScreenshot,
  getAndroidDeviceId,
  REACT_BUNDLE_NAME,
  REACT_REFERENCE_SNAPSHOT_PATH,
  removeReversedAdbPort,
  reverseAdbPort,
  startReactFixtureServer,
  withTimeout,
} from './helpers/react-fixture-e2e.js';
import type { FixtureServer } from './helpers/react-fixture-e2e.js';

const RUN_ANDROID_INTEGRATION =
  process.env['UI_JUDGE_ANDROID_INTEGRATION'] === '1';

type LynxConnection = Awaited<ReturnType<typeof Lynx.connect>>;

describe.skipIf(!RUN_ANDROID_INTEGRATION)(
  'visual evaluation Android E2E',
  () => {
    let fixtureServer: FixtureServer | undefined;
    let reversedPort: number | undefined;
    let lynx: LynxConnection | undefined;
    let page: KittenLynxView | undefined;

    beforeAll(async () => {
      fixtureServer = await startReactFixtureServer();
      reversedPort = fixtureServer.port;
      await reverseAdbPort(reversedPort);

      const deviceId = getAndroidDeviceId();
      lynx = await withTimeout(
        Lynx.connect(deviceId ? { deviceId } : undefined),
        120_000,
        'Timed out connecting to Kitten-Lynx.',
      );
      page = await lynx.newPage();
    }, 180_000);

    afterAll(async () => {
      await withTimeout(
        lynx?.close() ?? Promise.resolve(),
        10_000,
        'Timed out closing Kitten-Lynx.',
      ).catch(() => {
        // Keep teardown best-effort when the Kitten-Lynx bridge is wedged.
      });
      if (reversedPort !== undefined) {
        await withTimeout(
          removeReversedAdbPort(reversedPort),
          10_000,
          'Timed out removing adb port reverse.',
        ).catch(() => {
          // The emulator can already be gone during teardown.
        });
      }
      await withTimeout(
        fixtureServer?.dispose() ?? Promise.resolve(),
        10_000,
        'Timed out disposing fixture server.',
      ).catch(() => {
        // The test is already finished; do not mask the original failure.
      });
    }, 30_000);

    it(
      'evaluates the React fixture screenshot against its reference snapshot',
      async () => {
        if (!fixtureServer || !page) {
          throw new Error('React Android fixture test was not initialized.');
        }

        const templateUrl = fixtureServer.createUrl(REACT_BUNDLE_NAME);
        const referenceImage = await readFile(REACT_REFERENCE_SNAPSHOT_PATH);
        const result = await runVisualEvaluation(
          {
            capture: {
              waitTimeMs: 0,
            },
            referenceImage: referenceImage.toString('base64'),
            templateUrl,
            traceId: 'react-fixture-visual-evaluation-e2e',
          },
          {
            capture: async (options) => {
              expect(options).toMatchObject({
                targetPageUrl: templateUrl,
                traceId: 'react-fixture-visual-evaluation-e2e',
                waitTimeMs: 0,
              });
              const deviceScreenshot = await captureReactFixtureScreenshot(
                page,
                options.targetPageUrl,
              );
              return deviceScreenshot.toString('base64');
            },
          },
        );

        expect(result.ok).toBe(true);
        expect(result.artifacts.referenceImageBase64).toBeTruthy();
        expect(result.artifacts.deviceImageBase64).toBeTruthy();
        expect(result.artifacts.alignedReferenceImageBase64).toBeTruthy();
        expect(result.artifacts.alignedDeviceImageBase64).toBeTruthy();
        expect(result.artifacts.diffImageBase64).toBeTruthy();
        expect(result.metrics.alignResult).not.toBeUndefined();
        expect(result.metrics.compareResult.similarity).toBeGreaterThanOrEqual(
          0,
        );
        expect(result.metrics.compareResult.similarity).toBeLessThanOrEqual(1);
        expect(result.metrics.evaluationResult.score).toBeTypeOf('number');
        expect(result.score).toBe(result.metrics.evaluationResult.score);
        expect(result.reason).toBe(result.metrics.evaluationResult.reason);
      },
      240_000,
    );
  },
);
