// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import _reloadApp from './reloadApp.js';

import type { Options, Status } from './index.js';

declare const lynxCoreInject: {
  tt: {
    nativeApp: {
      callLepusMethod: (
        methodName: string,
        options: Record<string, unknown>,
        callback?: () => void,
        groupId?: string,
        stackTraces?: string,
      ) => void;
    };
  };
};

function reloadApp(options: Options, status: Status): void {
  lynxCoreInject.tt.nativeApp.callLepusMethod('reloadApp', {
    ...options,
    status,
  }, () => {
    return;
  });

  _reloadApp(options, status);
}

export default reloadApp;
