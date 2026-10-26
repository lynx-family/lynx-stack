// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import { templateManager } from '../ts/client/mainthread/TemplateManager.js';

const entryUrl = 'http://localhost/entry.web.bundle';
const externalUrl = 'http://localhost/external.web.bundle';
const lazyUrl = 'http://localhost/lazy.web.bundle';
const scripts: Record<string, Record<string, string>> = {
  [entryUrl]: { '/app-service.js': 'blob:entry' },
  [externalUrl]: { '/shared.js': 'blob:shared' },
  [lazyUrl]: { '/app-service.js': 'blob:lazy' },
};

describe('background runtime startup', () => {
  let instance: LynxViewInstance;
  const updateBTSChunk = rstest.fn<
    LynxViewInstance['backgroundThread']['updateBTSChunk']
  >();
  const startBTS = rstest.fn();

  beforeEach(() => {
    updateBTSChunk.mockReset().mockResolvedValue(undefined);
    startBTS.mockReset();
    rstest.spyOn(templateManager, 'getBundle').mockImplementation((url) => ({
      backgroundCode: scripts[url]!,
    }));
    // Exercise the real callback without creating a Worker or WASM context.
    instance = Object.create(LynxViewInstance.prototype) as LynxViewInstance;
    Object.assign(instance, {
      templateUrl: entryUrl,
      backgroundThread: { updateBTSChunk, startBTS },
    });
  });

  afterEach(() => {
    rstest.restoreAllMocks();
  });

  test.each([externalUrl, lazyUrl])(
    'registers %s without starting the entry runtime early',
    async (url) => {
      await instance.onBTSScriptsLoaded(url);

      expect(updateBTSChunk).toHaveBeenCalledWith(url, scripts[url]);
      expect(startBTS).not.toHaveBeenCalled();

      await instance.onBTSScriptsLoaded(entryUrl);

      expect(updateBTSChunk).toHaveBeenCalledWith(entryUrl, scripts[entryUrl]);
      expect(startBTS).toHaveBeenCalledTimes(1);
    },
  );

  test('waits for the Worker to acknowledge entry script registration', async () => {
    const registration = Promise.withResolvers<void>();
    updateBTSChunk.mockImplementation((url) =>
      url === entryUrl ? registration.promise : Promise.resolve()
    );

    const entryLoaded = instance.onBTSScriptsLoaded(entryUrl);
    await instance.onBTSScriptsLoaded(externalUrl);
    expect(updateBTSChunk).toHaveBeenCalledWith(entryUrl, scripts[entryUrl]);
    expect(startBTS).not.toHaveBeenCalled();

    registration.resolve();
    await entryLoaded;
    expect(startBTS).toHaveBeenCalledTimes(1);

    await instance.onBTSScriptsLoaded(lazyUrl);
    expect(updateBTSChunk).toHaveBeenCalledWith(lazyUrl, scripts[lazyUrl]);
    expect(startBTS).toHaveBeenCalledTimes(1);
  });

  test('does not start when entry script registration fails', async () => {
    const error = new Error('Script registration failed');
    updateBTSChunk.mockRejectedValueOnce(error);

    await expect(instance.onBTSScriptsLoaded(entryUrl)).rejects.toBe(error);
    await instance.onBTSScriptsLoaded(externalUrl);

    expect(startBTS).not.toHaveBeenCalled();
  });
});
