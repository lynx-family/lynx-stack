export type WASMModule = typeof import('./standard.js');
export declare let wasm: WASMModule;
export declare function initWasm(): Promise<void>;
