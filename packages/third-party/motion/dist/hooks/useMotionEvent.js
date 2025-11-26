import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
export function useMotionValueRefEvent(valueRef, event, callback) {
    const unListenRef = useMainThreadRef();
    useEffect(() => {
        void runOnMainThread(() => {
            'main thread';
            unListenRef.current = valueRef.current.on(event, callback);
        })();
        return () => {
            void runOnMainThread(() => {
                'main thread';
                unListenRef.current?.();
            })();
        };
    }, [callback]);
}
//# sourceMappingURL=useMotionEvent.js.map