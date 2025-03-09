import type { LynxFiberElement } from '@lynx-js/lynx-dom';
import * as queries from './queries';

export type BoundFunction<T> = T extends (
  container: LynxFiberElement,
  ...args: infer P
) => infer R ? (...args: P) => R
  : never;

export type BoundFunctions<Q> = Q extends typeof queries ?
    & {
      getByLabelText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.GetByText<T>>>
      ): ReturnType<queries.GetByText<T>>;
      getAllByLabelText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByText<T>>>
      ): ReturnType<queries.AllByText<T>>;
      queryByLabelText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.QueryByText<T>>>
      ): ReturnType<queries.QueryByText<T>>;
      queryAllByLabelText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByText<T>>>
      ): ReturnType<queries.AllByText<T>>;
      findByLabelText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindByText<T>>>
      ): ReturnType<queries.FindByText<T>>;
      findAllByLabelText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindAllByText<T>>>
      ): ReturnType<queries.FindAllByText<T>>;
      getByPlaceholderText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.GetByBoundAttribute<T>>>
      ): ReturnType<queries.GetByBoundAttribute<T>>;
      getAllByPlaceholderText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      queryByPlaceholderText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.QueryByBoundAttribute<T>>>
      ): ReturnType<queries.QueryByBoundAttribute<T>>;
      queryAllByPlaceholderText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      findByPlaceholderText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindByBoundAttribute<T>>>
      ): ReturnType<queries.FindByBoundAttribute<T>>;
      findAllByPlaceholderText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindAllByBoundAttribute<T>>>
      ): ReturnType<queries.FindAllByBoundAttribute<T>>;
      getByText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.GetByText<T>>>
      ): ReturnType<queries.GetByText<T>>;
      getAllByText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByText<T>>>
      ): ReturnType<queries.AllByText<T>>;
      queryByText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.QueryByText<T>>>
      ): ReturnType<queries.QueryByText<T>>;
      queryAllByText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByText<T>>>
      ): ReturnType<queries.AllByText<T>>;
      findByText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindByText<T>>>
      ): ReturnType<queries.FindByText<T>>;
      findAllByText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindAllByText<T>>>
      ): ReturnType<queries.FindAllByText<T>>;
      getByAltText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.GetByBoundAttribute<T>>>
      ): ReturnType<queries.GetByBoundAttribute<T>>;
      getAllByAltText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      queryByAltText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.QueryByBoundAttribute<T>>>
      ): ReturnType<queries.QueryByBoundAttribute<T>>;
      queryAllByAltText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      findByAltText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindByBoundAttribute<T>>>
      ): ReturnType<queries.FindByBoundAttribute<T>>;
      findAllByAltText<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindAllByBoundAttribute<T>>>
      ): ReturnType<queries.FindAllByBoundAttribute<T>>;
      getByTitle<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.GetByBoundAttribute<T>>>
      ): ReturnType<queries.GetByBoundAttribute<T>>;
      getAllByTitle<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      queryByTitle<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.QueryByBoundAttribute<T>>>
      ): ReturnType<queries.QueryByBoundAttribute<T>>;
      queryAllByTitle<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      findByTitle<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindByBoundAttribute<T>>>
      ): ReturnType<queries.FindByBoundAttribute<T>>;
      findAllByTitle<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindAllByBoundAttribute<T>>>
      ): ReturnType<queries.FindAllByBoundAttribute<T>>;
      getByDisplayValue<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.GetByBoundAttribute<T>>>
      ): ReturnType<queries.GetByBoundAttribute<T>>;
      getAllByDisplayValue<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      queryByDisplayValue<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.QueryByBoundAttribute<T>>>
      ): ReturnType<queries.QueryByBoundAttribute<T>>;
      queryAllByDisplayValue<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      findByDisplayValue<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindByBoundAttribute<T>>>
      ): ReturnType<queries.FindByBoundAttribute<T>>;
      findAllByDisplayValue<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindAllByBoundAttribute<T>>>
      ): ReturnType<queries.FindAllByBoundAttribute<T>>;
      getByRole<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.GetByRole<T>>>
      ): ReturnType<queries.GetByRole<T>>;
      getAllByRole<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByRole<T>>>
      ): ReturnType<queries.AllByRole<T>>;
      queryByRole<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.QueryByRole<T>>>
      ): ReturnType<queries.QueryByRole<T>>;
      queryAllByRole<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByRole<T>>>
      ): ReturnType<queries.AllByRole<T>>;
      findByRole<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindByRole<T>>>
      ): ReturnType<queries.FindByRole<T>>;
      findAllByRole<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindAllByRole<T>>>
      ): ReturnType<queries.FindAllByRole<T>>;
      getByTestId<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.GetByBoundAttribute<T>>>
      ): ReturnType<queries.GetByBoundAttribute<T>>;
      getAllByTestId<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      queryByTestId<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.QueryByBoundAttribute<T>>>
      ): ReturnType<queries.QueryByBoundAttribute<T>>;
      queryAllByTestId<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.AllByBoundAttribute<T>>>
      ): ReturnType<queries.AllByBoundAttribute<T>>;
      findByTestId<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindByBoundAttribute<T>>>
      ): ReturnType<queries.FindByBoundAttribute<T>>;
      findAllByTestId<T extends LynxFiberElement = LynxFiberElement>(
        ...args: Parameters<BoundFunction<queries.FindAllByBoundAttribute<T>>>
      ): ReturnType<queries.FindAllByBoundAttribute<T>>;
    }
    & {
      [P in keyof Q]: BoundFunction<Q[P]>;
    }
  : {
    [P in keyof Q]: BoundFunction<Q[P]>;
  };

export type Query = (
  container: LynxFiberElement,
  ...args: any[]
) =>
  | Error
  | LynxFiberElement
  | LynxFiberElement[]
  | Promise<LynxFiberElement[]>
  | Promise<LynxFiberElement>
  | null;

export interface Queries {
  [T: string]: Query;
}

export function getQueriesForElement<
  QueriesToBind extends Queries = typeof queries,
  // Extra type parameter required for reassignment.
  T extends QueriesToBind = QueriesToBind,
  Element,
>(element: Element, queriesToBind?: T): BoundFunctions<T>;
