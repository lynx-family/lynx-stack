// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { writeFile } from 'node:fs/promises';

import { afterAll, beforeAll, describe, it } from '@rstest/core';

import { Lynx } from '../../../testing-library/kitten-lynx/src/index.js';
import type {
  KittenLynxView,
} from '../../../testing-library/kitten-lynx/src/index.js';
import {
  REACT_BUNDLE_NAME,
  REACT_REFERENCE_SNAPSHOT_PATH,
  captureReactFixtureScreenshot,
  getAndroidDeviceId,
  removeReversedAdbPort,
  reverseAdbPort,
  startReactFixtureServer,
  withTimeout,
} from '../tests/helpers/react-fixture-e2e.js';
import type { FixtureServer } from '../tests/helpers/react-fixture-e2e.js';

type LynxConnection = Awaited<ReturnType<typeof Lynx.connect>>;

describe('update React fixture reference snapshot', () => {
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
      // Keep teardown best-effort after snapshot capture failures.
    });
    if (reversedPort !== undefined) {
      await withTimeout(
        removeReversedAdbPort(reversedPort),
        10_000,
        'Timed out removing adb port reverse.',
      ).catch(() => {
        // The target device can already be gone during teardown.
      });
    }
    await withTimeout(
      fixtureServer?.dispose() ?? Promise.resolve(),
      10_000,
      'Timed out disposing fixture server.',
    ).catch(() => {
      // Do not mask the original script failure.
    });
  }, 30_000);

  it('captures and writes the React fixture snapshot', async () => {
    if (!fixtureServer || !page) {
      throw new Error(
        'React Android fixture snapshot script was not initialized.',
      );
    }

    const templateUrl = fixtureServer.createUrl(REACT_BUNDLE_NAME);
    const screenshot = await captureReactFixtureScreenshot(page, templateUrl);
    await writeFile(REACT_REFERENCE_SNAPSHOT_PATH, screenshot);
  }, 240_000);
});
