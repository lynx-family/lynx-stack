import {
  queries,
  Queries,
  BoundFunction,
} from '@lynx-js/lynx-dom-testing-library';
import { LynxFiberElement } from '@lynx-js/lynx-dom';
import { ComponentChild, ComponentType } from 'preact';
export * from '@lynx-js/lynx-dom-testing-library';

export interface RenderOptions<Q extends Queries = typeof queries> {
  queries?: Q;
  wrapper?: ComponentChild;
  /**
   * Render your component in the main thread or not.
   *
   * @default false
   */
  enableMainThread?: boolean;
  /**
   * Render your component in the background thread or not.
   *
   * @default true
   */
  enableBackgroundThread?: boolean;
}

export type RenderResult<Q extends Queries = typeof queries> = {
  container: LynxFiberElement;
  rerender: (ui: ComponentChild) => void;
  unmount: () => boolean;
} & { [P in keyof Q]: BoundFunction<Q[P]> };

/**
 * Render into a container which is appended to document.body. It should be used with cleanup.
 */
export function render(
  ui: ComponentChild,
  options?: Omit<RenderOptions, 'queries'>,
): RenderResult;
export function render<Q extends Queries>(
  ui: ComponentChild,
  options: RenderOptions<Q>,
): RenderResult<Q>;
/**
 * Unmounts Preact trees that were mounted with render.
 */
export function cleanup(): void;

export interface RenderHookResult<Result, Props> {
  /**
   * Triggers a re-render. The props will be passed to your renderHook callback.
   */
  rerender: (props?: Props) => void;
  /**
   * This is a stable reference to the latest value returned by your renderHook
   * callback
   */
  result: {
    /**
     * The value returned by your renderHook callback
     */
    current: Result;
  };
  /**
   * Unmounts the test component. This is useful for when you need to test
   * any cleanup your useEffects have.
   */
  unmount: () => void;
}

export interface RenderHookOptions<Props> {
  /**
   * The argument passed to the renderHook callback. Can be useful if you plan
   * to use the rerender utility to change the values passed to your hook.
   */
  initialProps?: Props;
  /**
   * Pass a React Component as the wrapper option to have it rendered around the inner element. This is most useful for creating
   *  reusable custom render functions for common data providers. See setup for examples.
   *
   *  @see https://testing-library.com/docs/react-testing-library/api/#wrapper
   */
  wrapper?: ComponentType<{ children: LynxFiberElement }>;
}

/**
 * Allows you to render a hook within a test React component without having to
 * create that component yourself.
 */
export function renderHook<Result, Props>(
  render: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props>,
): RenderHookResult<Result, Props>;

export function waitSchedule(): Promise<void>;
