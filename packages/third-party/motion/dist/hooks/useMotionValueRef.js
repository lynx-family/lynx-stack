import { runOnMainThread, useMainThreadRef, useMemo } from '@lynx-js/react';
import { runWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';
import { motionValue } from '../animation/index.js';
export function useMotionValueRef(value) {
    // @ts-expect-error expected
    const motionValueRef = useMainThreadRef();
    useMemo(() => {
        function setMotionValue(value) {
            'main thread';
            if (!motionValueRef.current) {
                motionValueRef.current = motionValue(value);
            }
        }
        if (__BACKGROUND__) {
            void runOnMainThread(setMotionValue)(value);
        }
        else {
            runWorkletCtx(setMotionValue, [
                value,
            ]);
        }
    }, []);
    return motionValueRef;
}
//# sourceMappingURL=useMotionValueRef.js.map