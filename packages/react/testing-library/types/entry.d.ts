/**
 * @packageDocumentation
 *
 * ReactLynx Testing Library is a simple and complete ReactLynx
 * unit testing library that encourages good testing practices.
 *
 * Inspired by {@link https://testing-library.com/docs/react-testing-library/intro | React Testing Library} and {@link https://github.com/jsdom/jsdom | jsdom}.
 */

import { queries, Queries, BoundFunction } from '@testing-library/dom';
import { LynxElement, type ElementTree, type LynxTestingEnv } from '@lynx-js/testing-environment';
import { act } from 'preact/test-utils';
export * from '@testing-library/dom';
export { ElementTree, LynxTestingEnv, act };

/**
 * The options for {@link render}.
 *
 * @public
 */
export interface RenderOptions<Q extends Queries = typeof queries> {
  /**
   * Queries to bind. Overrides the default set from DOM Testing Library unless merged.
   *
   * @example
   *
   * ```ts
   * // Example, a function to traverse table contents
   * import * as tableQueries from 'my-table-query-library'
   * import { queries } from '@lynx-js/react/testing-library'
   *
   * const { getByRowColumn, getByText } = render(<MyTable />, {
   *   queries: {...queries, ...tableQueries},
   * })
   *
   * ```
   */
  queries?: Q;
  /**
   * Pass a React Component as the wrapper option to have it rendered around the inner element. This is most useful for creating
   *  reusable custom render functions for common data providers. See setup for examples.
   *
   * @example
   *
   * ```ts
   * import { render } from '@lynx-js/react/testing-library'
   * import { ThemeProvider } from 'my-ui-lib'
   * import { TranslationProvider } from 'my-i18n-lib'
   * import defaultStrings from 'i18n/en-x-default'
   *
   * const AllTheProviders = ({children}) => {
   *   return (
   *     <ThemeProvider theme="light">
   *       <TranslationProvider messages={defaultStrings}>
   *         {children}
   *       </TranslationProvider>
   *     </ThemeProvider>
   *   )
   * }
   *
   * const customRender = (ui, options) =>
   *   render(ui, { wrapper: AllTheProviders, ...options })
   *
   * // re-export everything
   * export * from '@lynx-js/react/testing-library'
   *
   * // override render method
   * export { customRender as render }
   * ```
   */
  wrapper?: React.JSXElementConstructor<{ children: React.ReactNode }> | undefined;
  /**
   * Render your component in the main thread or not.
   *
   * It is recommended to use this option only when you need to test the {@link https://lynxjs.org/zh/guide/interaction/ifr.html | IFR} behavior.
   *
   * @defaultValue false
   */
  enableMainThread?: boolean;
  /**
   * Render your component in the background thread or not.
   *
   * Note that all user code in the top level will be executed in the background thread by default. (eg. `__BACKGROUND__` is `true` in the top level)
   *
   * @defaultValue true
   */
  enableBackgroundThread?: boolean;
}

/**
 * The result of {@link render}
 *
 * @public
 */
export type RenderResult<Q extends Queries = typeof queries> = {
  container: LynxElement;
  rerender: (ui: React.ReactNode) => void;
  unmount: () => boolean;
} & { [P in keyof Q]: BoundFunction<Q[P]> };

/**
 * Render into the page. It should be used with cleanup.
 *
 * @example
 *
 * ```ts
 * import { render} from '@lynx-js/react/testing-library'
 *
 * const WrapperComponent = ({ children }) => (
 *     <view data-testid='wrapper'>{children}</view>
 * );
 * const Comp = () => {
 *   return <view data-testid='inner' style="background-color: yellow;" />;
 * };
 * const { container, getByTestId } = render(<Comp />, {
 *   wrapper: WrapperComponent,
 * });
 * expect(getByTestId('wrapper')).toBeInTheDocument();
 * expect(container.firstChild).toMatchInlineSnapshot(`
 *   <view
 *     data-testid="wrapper"
 *   >
 *     <view
 *       data-testid="inner"
 *       style="background-color: yellow;"
 *     />
 *   </view>
 * `);
 * ```
 *
 * @public
 */
export function render<Q extends Queries>(
  ui: React.ReactNode,
  options?: RenderOptions<Q>,
): RenderResult<Q>;
/**
 * Cleanup elements rendered to the page and Preact trees that were mounted with render.
 *
 * @public
 */
export function cleanup(): void;

/**
 * The result of {@link renderHook}
 *
 * @public
 */

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

/**
 * The options for {@link renderHook}
 *
 * @public
 */
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
   * @example
   *
   * ```ts
   * import { renderHook } from '@lynx-js/react/testing-library'
   * import { ThemeProvider } from 'my-ui-lib'
   * import { TranslationProvider } from 'my-i18n-lib'
   * import defaultStrings from 'i18n/en-x-default'
   *
   * const AllTheProviders = ({children}) => {
   *   return (
   *     <ThemeProvider theme="light">
   *       <TranslationProvider messages={defaultStrings}>
   *         {children}
   *       </TranslationProvider>
   *     </ThemeProvider>
   *   )
   * }
   *
   * const customRenderHook = (ui, options) =>
   *   renderHook(ui, { wrapper: AllTheProviders, ...options })
   *
   * // re-export everything
   * export * from '@lynx-js/react/testing-library'
   *
   * // override renderHook method
   * export { customRender as renderHook }
   * ```
   */
  wrapper?: React.JSXElementConstructor<{ children: React.ReactNode }> | undefined;
}

/**
 * Allows you to render a hook within a test React component without having to
 * create that component yourself.
 *
 * @example
 *
 * ```ts
 * import { renderHook } from '@lynx-js/react/testing-library'
 *
 * const Context = createContext('default');
 * function Wrapper({ children }) {
 *   return <Context.Provider value='provided'>{children}</Context.Provider>;
 * }
 * const { result } = renderHook(
 *   () => {
 *     return useContext(Context);
 *   },
 *   {
 *     wrapper: Wrapper,
 *   },
 * );
 *
 * expect(result.current).toEqual('provided');
 * ```
 *
 * @public
 */
export function renderHook<Result, Props>(
  render: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props>,
): RenderHookResult<Result, Props>;

/**
 * Wait for the next event loop.
 *
 * It will be useful when you want to wait for the next event loop to finish.
 *
 * @deprecated Please use `act` instead
 */
export function waitSchedule(): Promise<void>;
