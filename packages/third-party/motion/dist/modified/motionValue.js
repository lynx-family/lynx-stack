// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { MotionValue } from 'motion-dom';
class CustomMotionValue extends MotionValue {
    toJSON() {
        return {};
    }
}
export function motionValue(init, options) {
    return new CustomMotionValue(init, options);
}
//# sourceMappingURL=motionValue.js.map