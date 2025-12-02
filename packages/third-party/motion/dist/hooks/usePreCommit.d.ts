/**
 * An experimental hook dedicated to make MTS run on firstScreenPaint
 * Can be used starting from ReactLynx 0.113.0
 * @experimental
 * @param cb A main-thread callback to run on firstScreen
 */
export declare function usePreCommit(cb: CallableFunction): void;
