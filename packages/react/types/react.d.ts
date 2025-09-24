// Import to apply global declarations and then re-export documentable members.
import './react.docs.js';
export * from './react.docs.js';

// Types
export type {
  Attributes,
  CElement,
  CFactory,
  ChildContextProvider,
  ClassAttributes,
  ClassType,
  ClassicComponent,
  ClassicComponentClass,
  ClassicElement,
  ClassicFactory,
  ComponentClass,
  ComponentElement,
  ComponentFactory,
  ComponentLifecycle,
  ComponentProps,
  ComponentPropsWithRef,
  ComponentPropsWithoutRef,
  ComponentRef,
  ComponentSpec,
  ComponentState,
  ComponentType,
  Consumer,
  ConsumerProps,
  Context,
  ContextType,
  CustomComponentPropsWithRef,
  DependencyList,
  DeprecatedLifecycle,
  Dispatch,
  DispatchWithoutAction,
  EffectCallback,
  ElementRef,
  ElementType,
  ExoticComponent,
  FC,
  Factory,
  ForwardRefExoticComponent,
  ForwardRefRenderFunction,
  ForwardedRef,
  FunctionComponent,
  FunctionComponentElement,
  FunctionComponentFactory,
  GetDerivedStateFromError,
  GetDerivedStateFromProps,
  JSXElementConstructor,
  Key,
  LazyExoticComponent,
  LegacyRef,
  MemoExoticComponent,
  Mixin,
  MutableRefObject,
  NamedExoticComponent,
  NewLifecycle,
  PropsWithChildren,
  PropsWithRef,
  PropsWithoutRef,
  Provider,
  ProviderExoticComponent,
  ProviderProps,
  ReactComponentElement,
  ReactElement,
  ReactInstance,
  ReactNode,
  Reducer,
  ReducerAction,
  ReducerState,
  ReducerStateWithoutAction,
  ReducerWithoutAction,
  Ref,
  RefAttributes,
  RefCallback,
  RefObject,
  SFCFactory,
  SVGFactory,
  SetStateAction,
  StaticLifecycle,
  TransitionFunction,
  TransitionStartFunction,
  VFC,
  VoidFunctionComponent,
} from 'react';

import type { MainThread, NodesRef } from '@lynx-js/types';
import type { Key, ReactNode, Ref } from 'react';

import type { Lynx as LynxExtended } from './react.docs.js';

declare module '@lynx-js/types' {
  interface StandardProps {
    children?: ReactNode;
    ref?: Ref<NodesRef>;
    key?: Key | null | undefined;
    'main-thread:ref'?: Ref<MainThread.Element>;
  }

  interface Lynx extends LynxExtended {
    /**
     * Select the first element matching the given CSS selector in the page.
     * @param selector - CSS Selector string.
     * @public
     */
    querySelector: (selector: string) => MainThread.Element | null;

    /**
     * Select all the elements matching the given CSS selector in the page.
     * @param selector - CSS Selector string.
     * @public
     */
    querySelectorAll: (selector: string) => MainThread.Element[];
  }

  export interface ListItemProps {
    /**
     * Control (mainly reduce) the reuse behavior of `<list-item />`
     *
     * @example
     *
     * Avoid unexpected reuse.
     *
     * ```tsx
     * {[1, "2", 3].map((item) => {
     *  return (
     *    <list-item key={item} item-key={item} reuse-identifier={typeof item}>
     *      <text>{item}</text>
     *    </list-item>
     *  );
     * })}
     * ```
     *
     * When `<list-item />` is returned from the array `.map()`,
     * since they have the same form and position at the compile stage,
     * we will generate the same reuse-identifier for them,
     * and we will think that this group of `<list-item />` can be reused with each other.
     * Explicitly specifying the reuse-identifier can avoid some unexpected reuse.
     * For example, in the above code, if we do not want numbers and strings to be reused with each other,
     * we can use typeof item as the reuse-identifier.
     * By default, the developer does not provide a reuse-identifier, which is determined by the framework at the compile stage.
     */
    'reuse-identifier'?: Key | null | undefined;

    /**
     * Makes the `<list-item />` deferred, meaning it will not be eagerly rendered
     * on the main thread like a non-deferred `<list-item />`.
     * Instead, it will be rendered on the background thread when necessary.
     *
     * As a result, rendering becomes asynchronous,
     * which means that during extremely fast scrolling, some `<list-item />`s may not have been rendered yet—these will usually appear blank.
     *
     * @example
     *
     * Render a `<list-item />` containing a heavyweight component on the background thread.
     *
     * ```tsx
     * <list-item defer item-key="heavy-item">
     *   <HeavyComponent />
     * </list-item>
     * ```
     *
     * @example
     *
     * Turn on the `unmountRecycled` switch to uninstall invisible JSX nodes.
     * If they are components, related lifecycle (e.g. `componentWillUnmount` and cleanup of `useEffect`) will be executed accordingly.
     * If they are intrinsic element, they will be `unref`-ed (`ref` will be set to `null` or cleanup of `ref` will be executed).
     *
     * ```tsx
     * <list-item defer={{ unmountRecycled: true }} item-key="some-item">
     *   <WillBeUnmountIfRecycled />
     * </list-item>
     * ```
     */
    'defer'?: boolean | { unmountRecycled?: boolean } | undefined;
  }

  export interface FrameworkRenderingTimings {
    reactLynxHydrate: {
      dsl: 'reactLynx';
      stage: 'hydrate';
      diffVdomStart: number;
      diffVdomEnd: number;
      packChangesStart: number;
      packChangesEnd: number;
      parseChangesStart: number;
      parseChangesEnd: number;
      patchChangesStart: number;
      patchChangesEnd: number;
      hydrateParseSnapshotStart: number;
      hydrateParseSnapshotEnd: number;
    };
    reactLynxUpdate: {
      dsl: 'reactLynx';
      stage: 'update';
      diffVdomStart: number;
      diffVdomEnd: number;
      packChangesStart: number;
      packChangesEnd: number;
      parseChangesStart: number;
      parseChangesEnd: number;
      patchChangesStart: number;
      patchChangesEnd: number;
    };
  }
}

export type { JSX } from '../runtime/jsx-runtime/index.d.ts';
