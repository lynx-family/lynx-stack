// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { MotionValue } from 'motion-dom';
/**
 * This hack is needed to prevent large bulk of cross thread communication happened.
 * This is because what MainThreadScript working for syncing MainThread and Background Thread
 * But actually this is not needed, because we have single source of truth in MainThread
 * So we can just ignore the cross thread communication
 */
// @ts-expect-error expected
MotionValue.prototype.toJSON = function () {
    return {};
};
export { motionValue } from 'motion-dom';
//# sourceMappingURL=MotionValue.js.map