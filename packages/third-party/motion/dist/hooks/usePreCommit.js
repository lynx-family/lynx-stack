// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { runWorkletCtx, setEomShouldFlushElementTree, } from '@lynx-js/react/worklet-runtime/bindings';
/**
 * An experimental hook dedicated to make MTS run on firstScreenPaint
 * Can be used starting from ReactLynx 0.113.0
 * @experimental
 * @param cb A main-thread callback to run on firstScreen
 */
export function usePreCommit(cb) {
    if (__MAIN_THREAD__) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        setEomShouldFlushElementTree(false);
        void Promise.resolve().then(() => {
            try {
                runWorkletCtx(cb, []);
            }
            catch (e) {
                console.error('Error occurred in preCommit hook', e);
            }
            finally {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                setEomShouldFlushElementTree(true);
            }
        });
    }
}
//# sourceMappingURL=usePreCommit.js.map