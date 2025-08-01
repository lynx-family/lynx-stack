/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
/**
 * lifted from the `console_log` example
 * Accepts a raw uint16 pointer from JS and transforms the inline style string into a JS string.
 * Returns `Some(JsString)` if the transformation was successful, or `None` if the input was empty or invalid.
 *
 * # Safety
 * The caller must ensure that `ptr` is valid and points to a slice of `u16` of length `len`.
 * This is a contract with the JavaScript side. Passing an invalid pointer or incorrect length may cause undefined behavior.
 */
export function transform_inline_style(ptr: string): string | undefined;
/**
 * Accepts raw uint16 pointers from JS and parses the inline style name and value into a JS array.
 * Returns `Some(Array)` if parsing was successful, or `None` if both results are empty.
 *
 * # Safety
 * The caller must ensure that `name_ptr` and `value_ptr` are valid and point to slices of `u16` of lengths `name_len` and `value_len` respectively.
 * Passing invalid pointers or incorrect lengths may cause undefined behavior.
 */
export function transform_raw_u16_inline_style_ptr_parsed(
  name_ptr: string,
  name_len: number,
  value_ptr: string,
  value_len: number,
): Array<any> | undefined;
export function malloc(size: number): number;
/**
 * Frees the allocated memory at the given pointer with the specified size.
 *
 * # Safety
 * The caller must ensure that `ptr` was allocated with the same size and alignment using `malloc`,
 * and that it is not used after being freed. Passing an invalid pointer or incorrect size may cause undefined behavior.
 */
export function free(ptr: number, size: number): void;
