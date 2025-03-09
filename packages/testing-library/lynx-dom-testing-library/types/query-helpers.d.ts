import type { LynxFiberElement } from '@lynx-js/lynx-dom';
import { Matcher, MatcherOptions } from './matches';
import { waitForOptions } from './wait-for';

export type WithSuggest = { suggest?: boolean };

export type GetErrorFunction<Arguments extends any[] = [string]> = (
  c: LynxFiberElement | null,
  ...args: Arguments
) => string;

export interface SelectorMatcherOptions extends MatcherOptions {
  selector?: string;
  ignore?: boolean | string;
}

export type QueryByAttribute = (
  attribute: string,
  container: LynxFiberElement,
  id: Matcher,
  options?: MatcherOptions,
) => LynxFiberElement | null;

export type AllByAttribute = (
  attribute: string,
  container: LynxFiberElement,
  id: Matcher,
  options?: MatcherOptions,
) => LynxFiberElement[];

export const queryByAttribute: QueryByAttribute;
export const queryAllByAttribute: AllByAttribute;
export function getElementError(
  message: string | null,
  container: LynxFiberElement,
): Error;

/**
 * query methods have a common call signature. Only the return type differs.
 */
export type QueryMethod<Arguments extends any[], Return> = (
  container: LynxFiberElement,
  ...args: Arguments
) => Return;
export type QueryBy<Arguments extends any[]> = QueryMethod<
  Arguments,
  LynxFiberElement | null
>;
export type GetAllBy<Arguments extends any[]> = QueryMethod<
  Arguments,
  LynxFiberElement[]
>;
export type FindAllBy<Arguments extends any[]> = QueryMethod<
  [Arguments[0], Arguments[1]?, waitForOptions?],
  Promise<LynxFiberElement[]>
>;
export type GetBy<Arguments extends any[]> = QueryMethod<
  Arguments,
  LynxFiberElement
>;
export type FindBy<Arguments extends any[]> = QueryMethod<
  [Arguments[0], Arguments[1]?, waitForOptions?],
  Promise<LynxFiberElement>
>;

export type BuiltQueryMethods<Arguments extends any[]> = [
  QueryBy<Arguments>,
  GetAllBy<Arguments>,
  GetBy<Arguments>,
  FindAllBy<Arguments>,
  FindBy<Arguments>,
];

export function buildQueries<Arguments extends any[]>(
  queryAllBy: GetAllBy<Arguments>,
  getMultipleError: GetErrorFunction<Arguments>,
  getMissingError: GetErrorFunction<Arguments>,
): BuiltQueryMethods<Arguments>;
