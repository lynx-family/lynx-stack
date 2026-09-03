import { describe, expect, it } from '@rstest/core';

import ReactLegacyRuntime, * as ReactLegacyRuntimeNamespace from '@lynx-js/react/legacy-react-runtime';
import { wrapWithLynxComponent } from '@lynx-js/react/element-template/internal';
import {
  __runInJS,
  Component,
  PureComponent,
  createContext,
  createRef,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from '@lynx-js/react/legacy-react-runtime';

const expectedLegacyRuntimeKeys = [
  'Component',
  'PureComponent',
  '__runInJS',
  'createContext',
  'createRef',
  'default',
  'lazy',
  'useCallback',
  'useEffect',
  'useMemo',
  'useReducer',
  'useRef',
  'useState',
];

const expectedLegacyRuntimeDefaultKeys = expectedLegacyRuntimeKeys.filter(key => key !== 'default');

describe('element-template legacy-react-runtime adapter', () => {
  it('exposes the compat legacy runtime surface in element-template mode', () => {
    expect(Component).toEqual(expect.any(Function));
    expect(PureComponent).toEqual(expect.any(Function));
    expect(createContext).toEqual(expect.any(Function));
    expect(createRef).toEqual(expect.any(Function));
    expect(lazy).toEqual(expect.any(Function));
    expect(useState).toEqual(expect.any(Function));
    expect(useReducer).toEqual(expect.any(Function));
    expect(useEffect).toEqual(expect.any(Function));
    expect(useMemo).toEqual(expect.any(Function));
    expect(useCallback).toEqual(expect.any(Function));
    expect(useRef).toEqual(expect.any(Function));
    expect(__runInJS).toEqual(expect.any(Function));
    expect(__runInJS(42)).toBe(42);

    expect(Object.keys(ReactLegacyRuntimeNamespace).sort()).toEqual(expectedLegacyRuntimeKeys);
    expect(Object.keys(ReactLegacyRuntime).sort()).toEqual(expectedLegacyRuntimeDefaultKeys);

    expect(ReactLegacyRuntime).toEqual({
      Component,
      PureComponent,
      createContext,
      createRef,
      lazy,
      useState,
      useReducer,
      useRef,
      useEffect,
      useMemo,
      useCallback,
      __runInJS,
    });
  });

  it('marks compat runtime components for ET internal component wrapping', () => {
    class CompatComponent extends Component {}
    const componentVNode = {
      type: CompatComponent,
      props: {
        className: 'compat-class',
        id: 'compat-id',
        retained: 'component-prop',
      },
    };

    const wrapped = wrapWithLynxComponent(
      (child, spread) => ({ child, spread }),
      componentVNode,
    );

    expect(wrapped).toEqual({
      child: componentVNode,
      spread: {
        className: 'compat-class',
        id: 'compat-id',
      },
    });
    expect(componentVNode.props).toEqual({
      retained: 'component-prop',
    });
  });
});
