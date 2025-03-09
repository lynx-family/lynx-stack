import type { LynxFiberElement } from '@lynx-js/lynx-dom';
import { ByRoleMatcher, Matcher, MatcherOptions } from './matches';
import { SelectorMatcherOptions } from './query-helpers';
import { waitForOptions } from './wait-for';

export type QueryByBoundAttribute<
  T extends LynxFiberElement = LynxFiberElement,
> = (
  container: LynxFiberElement,
  id: Matcher,
  options?: MatcherOptions,
) => T | null;

export type AllByBoundAttribute<T extends LynxFiberElement = LynxFiberElement> =
  (
    container: LynxFiberElement,
    id: Matcher,
    options?: MatcherOptions,
  ) => T[];

export type FindAllByBoundAttribute<
  T extends LynxFiberElement = LynxFiberElement,
> = (
  container: LynxFiberElement,
  id: Matcher,
  options?: MatcherOptions,
  waitForElementOptions?: waitForOptions,
) => Promise<T[]>;

export type GetByBoundAttribute<T extends LynxFiberElement = LynxFiberElement> =
  (
    container: LynxFiberElement,
    id: Matcher,
    options?: MatcherOptions,
  ) => T;

export type FindByBoundAttribute<
  T extends LynxFiberElement = LynxFiberElement,
> = (
  container: LynxFiberElement,
  id: Matcher,
  options?: MatcherOptions,
  waitForElementOptions?: waitForOptions,
) => Promise<T>;

export type QueryByText<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  id: Matcher,
  options?: SelectorMatcherOptions,
) => T | null;

export type AllByText<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  id: Matcher,
  options?: SelectorMatcherOptions,
) => T[];

export type FindAllByText<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  id: Matcher,
  options?: SelectorMatcherOptions,
  waitForElementOptions?: waitForOptions,
) => Promise<T[]>;

export type GetByText<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  id: Matcher,
  options?: SelectorMatcherOptions,
) => T;

export type FindByText<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  id: Matcher,
  options?: SelectorMatcherOptions,
  waitForElementOptions?: waitForOptions,
) => Promise<T>;

export interface ByRoleOptions {
  /** suppress suggestions for a specific query */
  suggest?: boolean;
  /**
   * If true includes elements in the query set that are usually excluded from
   * the accessibility tree. `role="none"` or `role="presentation"` are included
   * in either case.
   */
  hidden?: boolean;
  /**
   * If true only includes elements in the query set that are marked as
   * selected in the accessibility tree, i.e., `aria-selected="true"`
   */
  selected?: boolean;
  /**
   * If true only includes elements in the query set that are marked as
   * busy in the accessibility tree, i.e., `aria-busy="true"`
   */
  busy?: boolean;
  /**
   * If true only includes elements in the query set that are marked as
   * checked in the accessibility tree, i.e., `aria-checked="true"`
   */
  checked?: boolean;
  /**
   * If true only includes elements in the query set that are marked as
   * pressed in the accessibility tree, i.e., `aria-pressed="true"`
   */
  pressed?: boolean;
  /**
   * Filters elements by their `aria-current` state. `true` and `false` match `aria-current="true"` and `aria-current="false"` (as well as a missing `aria-current` attribute) respectively.
   */
  current?: boolean | string;
  /**
   * If true only includes elements in the query set that are marked as
   * expanded in the accessibility tree, i.e., `aria-expanded="true"`
   */
  expanded?: boolean;
  /**
   * Includes elements with the `"heading"` role matching the indicated level,
   * either by the semantic HTML heading elements `<h1>-<h6>` or matching
   * the `aria-level` attribute.
   */
  level?: number;
  value?: {
    now?: number;
    min?: number;
    max?: number;
    text?: Matcher;
  };
  /**
   * Includes every role used in the `role` attribute
   * For example *ByRole('progressbar', {queryFallbacks: true})` will find <div role="meter progressbar">`.
   */
  queryFallbacks?: boolean;
  /**
   * Only considers elements with the specified accessible name.
   */
  name?:
    | RegExp
    | string
    | ((accessibleName: string, element: LynxFiberElement) => boolean);
  /**
   * Only considers elements with the specified accessible description.
   */
  description?:
    | RegExp
    | string
    | ((accessibleDescription: string, element: LynxFiberElement) => boolean);
}

export type AllByRole<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  role: ByRoleMatcher,
  options?: ByRoleOptions,
) => T[];

export type GetByRole<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  role: ByRoleMatcher,
  options?: ByRoleOptions,
) => T;

export type QueryByRole<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  role: ByRoleMatcher,
  options?: ByRoleOptions,
) => T | null;

export type FindByRole<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  role: ByRoleMatcher,
  options?: ByRoleOptions,
  waitForElementOptions?: waitForOptions,
) => Promise<T>;

export type FindAllByRole<T extends LynxFiberElement = LynxFiberElement> = (
  container: LynxFiberElement,
  role: ByRoleMatcher,
  options?: ByRoleOptions,
  waitForElementOptions?: waitForOptions,
) => Promise<T[]>;

export function getByLabelText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<GetByText<T>>
): ReturnType<GetByText<T>>;
export function getAllByLabelText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<AllByText<T>>
): ReturnType<AllByText<T>>;
export function queryByLabelText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<QueryByText<T>>
): ReturnType<QueryByText<T>>;
export function queryAllByLabelText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<AllByText<T>>
): ReturnType<AllByText<T>>;
export function findByLabelText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindByText<T>>
): ReturnType<FindByText<T>>;
export function findAllByLabelText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<FindAllByText<T>>
): ReturnType<FindAllByText<T>>;
export function getByPlaceholderText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<GetByBoundAttribute<T>>
): ReturnType<GetByBoundAttribute<T>>;
export function getAllByPlaceholderText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function queryByPlaceholderText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<QueryByBoundAttribute<T>>
): ReturnType<QueryByBoundAttribute<T>>;
export function queryAllByPlaceholderText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function findByPlaceholderText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<FindByBoundAttribute<T>>
): ReturnType<FindByBoundAttribute<T>>;
export function findAllByPlaceholderText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<FindAllByBoundAttribute<T>>
): ReturnType<FindAllByBoundAttribute<T>>;
export function getByText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<GetByText<T>>
): ReturnType<GetByText<T>>;
export function getAllByText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<AllByText<T>>
): ReturnType<AllByText<T>>;
export function queryByText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<QueryByText<T>>
): ReturnType<QueryByText<T>>;
export function queryAllByText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<AllByText<T>>
): ReturnType<AllByText<T>>;
export function findByText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindByText<T>>
): ReturnType<FindByText<T>>;
export function findAllByText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindAllByText<T>>
): ReturnType<FindAllByText<T>>;
export function getByAltText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<GetByBoundAttribute<T>>
): ReturnType<GetByBoundAttribute<T>>;
export function getAllByAltText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function queryByAltText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<QueryByBoundAttribute<T>>
): ReturnType<QueryByBoundAttribute<T>>;
export function queryAllByAltText<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function findByAltText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindByBoundAttribute<T>>
): ReturnType<FindByBoundAttribute<T>>;
export function findAllByAltText<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindAllByBoundAttribute<T>>
): ReturnType<FindAllByBoundAttribute<T>>;
export function getByTitle<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<GetByBoundAttribute<T>>
): ReturnType<GetByBoundAttribute<T>>;
export function getAllByTitle<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function queryByTitle<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<QueryByBoundAttribute<T>>
): ReturnType<QueryByBoundAttribute<T>>;
export function queryAllByTitle<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function findByTitle<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindByBoundAttribute<T>>
): ReturnType<FindByBoundAttribute<T>>;
export function findAllByTitle<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindAllByBoundAttribute<T>>
): ReturnType<FindAllByBoundAttribute<T>>;
export function getByDisplayValue<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<GetByBoundAttribute<T>>
): ReturnType<GetByBoundAttribute<T>>;
export function getAllByDisplayValue<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function queryByDisplayValue<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<QueryByBoundAttribute<T>>
): ReturnType<QueryByBoundAttribute<T>>;
export function queryAllByDisplayValue<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function findByDisplayValue<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<FindByBoundAttribute<T>>
): ReturnType<FindByBoundAttribute<T>>;
export function findAllByDisplayValue<
  T extends LynxFiberElement = LynxFiberElement,
>(
  ...args: Parameters<FindAllByBoundAttribute<T>>
): ReturnType<FindAllByBoundAttribute<T>>;
export function getByRole<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<GetByRole<T>>
): ReturnType<GetByRole<T>>;
export function getAllByRole<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<AllByRole<T>>
): ReturnType<AllByRole<T>>;
export function queryByRole<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<QueryByRole<T>>
): ReturnType<QueryByRole<T>>;
export function queryAllByRole<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<AllByRole<T>>
): ReturnType<AllByRole<T>>;
export function findByRole<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindByRole<T>>
): ReturnType<FindByRole<T>>;
export function findAllByRole<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindAllByRole<T>>
): ReturnType<FindAllByRole<T>>;
export function getByTestId<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<GetByBoundAttribute<T>>
): ReturnType<GetByBoundAttribute<T>>;
export function getAllByTestId<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function queryByTestId<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<QueryByBoundAttribute<T>>
): ReturnType<QueryByBoundAttribute<T>>;
export function queryAllByTestId<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<AllByBoundAttribute<T>>
): ReturnType<AllByBoundAttribute<T>>;
export function findByTestId<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindByBoundAttribute<T>>
): ReturnType<FindByBoundAttribute<T>>;
export function findAllByTestId<T extends LynxFiberElement = LynxFiberElement>(
  ...args: Parameters<FindAllByBoundAttribute<T>>
): ReturnType<FindAllByBoundAttribute<T>>;
