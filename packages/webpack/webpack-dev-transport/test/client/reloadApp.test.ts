// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it, rstest } from '@rstest/core';

import reloadApp from '../../client/reloadApp.js';

describe('reloadApp', () => {
  describe('liveReload', () => {
    // New NativeModule that introduced in 3.2
    const LynxDevToolSetModule = {
      invokeCdp: rstest.fn(),
    };

    const EmptyModule = {};

    // Old NativeModule
    const LynxDevtoolSetModule = {
      invokeCdp: rstest.fn(),
    };

    const status = {
      currentHash: '123',
      previousHash: '456',
      isReconnecting: false,
    };

    beforeEach(() => {
      rstest.unstubAllGlobals();
      LynxDevToolSetModule.invokeCdp.mockClear();
      LynxDevtoolSetModule.invokeCdp.mockClear();
    });

    it('should live reload on legacy Lynx', () => {
      rstest.useFakeTimers();

      rstest.stubGlobal('NativeModules', {
        LynxDevtoolSetModule,
      });

      reloadApp({ liveReload: true, hot: false, progress: false }, status);

      expect(LynxDevtoolSetModule.invokeCdp).not.toBeCalled();

      rstest.runAllTimers();

      expect(LynxDevtoolSetModule.invokeCdp).toHaveBeenCalledWith(
        'Page.reload',
        JSON.stringify({
          method: 'Page.reload',
          params: {
            ignoreCache: true,
          },
        }),
        expect.any(Function),
      );
    });

    it('should live reload on Lynx >= 3.3', () => {
      rstest.useFakeTimers();

      rstest.stubGlobal('NativeModules', {
        LynxDevToolSetModule,
      });

      reloadApp({ liveReload: true, hot: false, progress: false }, status);

      expect(LynxDevToolSetModule.invokeCdp).not.toBeCalled();

      rstest.runAllTimers();

      expect(LynxDevToolSetModule.invokeCdp).toHaveBeenCalledWith(
        JSON.stringify({
          method: 'Page.reload',
          params: {
            ignoreCache: true,
          },
        }),
        expect.any(Function),
      );
    });

    it('should not throw on Lynx 3.2', () => {
      rstest.useFakeTimers();

      rstest.stubGlobal('NativeModules', {
        LynxDevToolSetModule: EmptyModule,
      });

      reloadApp({ liveReload: true, hot: false, progress: false }, status);

      expect(LynxDevtoolSetModule.invokeCdp).not.toBeCalled();

      rstest.runAllTimers();

      expect(LynxDevtoolSetModule.invokeCdp).not.toBeCalled();
    });

    it('should not throw on both modules are empty', () => {
      rstest.useFakeTimers();

      rstest.stubGlobal('NativeModules', {
        LynxDevToolSetModule: EmptyModule,
        LynxDevtoolSetModule: EmptyModule,
      });

      reloadApp({ liveReload: true, hot: false, progress: false }, status);

      expect(LynxDevtoolSetModule.invokeCdp).not.toBeCalled();
      expect(LynxDevToolSetModule.invokeCdp).not.toBeCalled();

      rstest.runAllTimers();

      expect(LynxDevtoolSetModule.invokeCdp).not.toBeCalled();
      expect(LynxDevToolSetModule.invokeCdp).not.toBeCalled();
    });

    it('should not throw when no modules are present', () => {
      rstest.useFakeTimers();

      rstest.stubGlobal('NativeModules', {});

      reloadApp({ liveReload: true, hot: false, progress: false }, status);

      expect(LynxDevToolSetModule.invokeCdp).not.toBeCalled();
      expect(LynxDevtoolSetModule.invokeCdp).not.toBeCalled();

      rstest.runAllTimers();

      expect(LynxDevToolSetModule.invokeCdp).not.toBeCalled();
      expect(LynxDevtoolSetModule.invokeCdp).not.toBeCalled();
    });

    it('should call new method when both modules are present', () => {
      rstest.useFakeTimers();

      rstest.stubGlobal('NativeModules', {
        LynxDevToolSetModule,
        LynxDevtoolSetModule,
      });

      reloadApp({ liveReload: true, hot: false, progress: false }, status);

      expect(LynxDevToolSetModule.invokeCdp).not.toBeCalled();
      expect(LynxDevtoolSetModule.invokeCdp).not.toBeCalled();

      rstest.runAllTimers();

      expect(LynxDevToolSetModule.invokeCdp).toHaveBeenCalledWith(
        JSON.stringify({
          method: 'Page.reload',
          params: {
            ignoreCache: true,
          },
        }),
        expect.any(Function),
      );

      expect(LynxDevtoolSetModule.invokeCdp).not.toBeCalled();
    });
  });
});
