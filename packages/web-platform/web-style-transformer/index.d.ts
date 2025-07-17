/* tslint:disable */
/* eslint-disable */
/**
 * accept a raw uint16 ptr from JS
 */
export function transform_raw_u16_inline_style_ptr(
  ptr: number,
  len: number,
): string | undefined;
export function transform_raw_u16_inline_style_ptr_parsed(
  name_ptr: number,
  name_len: number,
  value_ptr: number,
  value_len: number,
): Array<any> | undefined;
export function malloc(size: number): number;
export function free(ptr: number, size: number): void;

export type InitInput =
  | RequestInfo
  | URL
  | Response
  | BufferSource
  | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly transform_raw_u16_inline_style_ptr: (a: number, b: number) => any;
  readonly transform_raw_u16_inline_style_ptr_parsed: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => any;
  readonly malloc: (a: number) => number;
  readonly free: (a: number, b: number) => void;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(
  module: { module: SyncInitInput } | SyncInitInput,
): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
