// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

declare const mainThreadFunctionBrand: unique symbol;
declare const mainThreadDeepBrand: unique symbol;

/**
 * A function contract whose implementation executes on the main thread.
 *
 * Libraries use this brand in their published declarations to identify
 * receiving positions for generic directive-inference codegen. The optional
 * phantom property keeps ordinary function literals assignable; compilation,
 * not a runtime wrapper type, establishes the thread boundary.
 *
 * @public
 */
export type MainThreadFn<
  Args extends readonly unknown[] = readonly unknown[],
  Return = unknown,
> = ((...args: Args) => Return) & {
  readonly [mainThreadFunctionBrand]?: true;
};

/**
 * A structural value whose directly supplied function leaves execute on the
 * main thread.
 *
 * Package declaration codegen maps this brand to recursive structural
 * inference while leaving the runtime representation unchanged.
 *
 * @public
 */
export type MainThreadDeep<T> = T extends null | undefined ? T
  : T & {
    readonly [mainThreadDeepBrand]?: true;
  };

/**
 * Explicitly mark a function literal as a main-thread function.
 *
 * The compiler recognizes this marker through its package declaration and
 * inserts the same `"main thread"` directive used by manual worklets. At
 * runtime this is an identity function, including in unbundled development
 * paths.
 *
 * @public
 */
export function mainThread<
  Args extends readonly unknown[],
  Return,
>(
  fn: (...args: Args) => Return,
): MainThreadFn<Args, Return> {
  return fn;
}
