// @ts-nocheck
/**
 * `@lynx-js/react/testing-library` renders ReactLynx components in a
 * simulated dual-thread environment so they can be tested with Vitest or
 * Rstest. It follows the {@link https://testing-library.com/ | Testing Library}
 * conventions: render a component, query the element tree the way a user
 * would find things, fire events and assert on the result.
 *
 * For setup and the dual-thread rendering options, see the
 * {@link https://lynxjs.org/react/reactlynx-testing-library | guide on lynxjs.org}.
 *
 * @example
 *
 * ```tsx title="App.test.tsx"
 * import { expect, test } from 'vitest'
 * import { fireEvent, render } from '@lynx-js/react/testing-library'
 *
 * import { App } from './App.jsx'
 *
 * test('increments the counter', () => {
 *   const { getByText } = render(<App />)
 *   fireEvent.tap(getByText('Count: 0'))
 *   expect(getByText('Count: 1')).toBeTruthy()
 * })
 * ```
 *
 * @packageDocumentation
 */

export * from '../dist/index.d.ts';
import { ElementTree, LynxTestingEnv } from '../dist/index.d.ts';

declare global {
  var lynxTestingEnv: LynxTestingEnv;
  var elementTree: ElementTree;

  function onInjectBackgroundThreadGlobals(globals: any): void;
  function onInjectMainThreadGlobals(globals: any): void;
  function onSwitchedToBackgroundThread(): void;
  function onSwitchedToMainThread(): void;
  function onResetLynxTestingEnv(): void;
  function onInitWorkletRuntime(): void;
}
