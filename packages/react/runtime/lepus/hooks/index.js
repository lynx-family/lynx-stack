// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements hooks in main thread.
 * This module is modified from preact/hooks
 *
 * internal-preact/hooks/dist/hooks.mjs
 */

import { COMPONENT, DIFF, DIFFED, HOOK, RENDER, HOOKS, LIST, VALUE } from '@lynx-js/react/internal/constants';
import { options } from 'preact';

var currentIndex;
var currentComponent;
var previousComponent;
var currentHook = 0;

var oldBeforeDiff = options[DIFF];
var oldBeforeRender = options[RENDER];
var oldAfterDiff = options[DIFFED];

options[DIFF] = function(vnode) {
  currentComponent = null;
  if (oldBeforeDiff) oldBeforeDiff(vnode);
};

options[RENDER] = function(vnode) {
  if (oldBeforeRender) oldBeforeRender(vnode);
  currentComponent = vnode[COMPONENT];
  currentIndex = 0;
  previousComponent = currentComponent;
};

options[DIFFED] = function(vnode) {
  if (oldAfterDiff) oldAfterDiff(vnode);
  previousComponent = currentComponent = null;
};

function getHookState(index, type) {
  if (options[HOOK]) {
    options[HOOK](currentComponent, index, currentHook || type);
  }
  currentHook = 0;
  var hooks = currentComponent[HOOKS] || (currentComponent[HOOKS] = {
    [LIST]: [],
  });
  if (index >= hooks[LIST].length) {
    hooks[LIST].push({});
  }
  return hooks[LIST][index];
}

function useState(initialState) {
  currentHook = 1;
  return useReducer(invokeOrReturn, initialState);
}

function useReducer(reducer, initialState, init) {
  var hookState = getHookState(currentIndex++, 2);
  hookState._reducer = reducer;
  if (!hookState[COMPONENT]) {
    hookState[VALUE] = [!init ? invokeOrReturn(undefined, initialState) : init(initialState), function(action) {}];
    hookState[COMPONENT] = currentComponent;
  }
  return hookState[VALUE];
}

// background hooks
function useEffect(callback, args) {}
function useLayoutEffect(callback, args) {}
function useImperativeHandle(ref, createHandle, args) {}

function useRef(initialValue) {
  currentHook = 5;
  return useMemo(function() {
    return {
      current: initialValue,
    };
  }, []);
}

function useMemo(factory, args) {
  var state = getHookState(currentIndex++, 7);
  state[VALUE] = factory();
  return state[VALUE];
}

function useCallback(callback, args) {
  currentHook = 8;
  return useMemo(function() {
    return callback;
  }, args);
}

function useContext(context) {
  var provider = currentComponent.context[context.__c];
  var state = getHookState(currentIndex++, 9);
  state.c = context;
  if (!provider) return context.__;
  state[VALUE] = true;
  return provider.props.value;
}

function useDebugValue(value, formatter) {
  if (options.useDebugValue) {
    options.useDebugValue(formatter ? formatter(value) : /** @type {any}*/ value);
  }
}

function useErrorBoundary(cb) {
  var state = getHookState(currentIndex++, 10);
  state[VALUE] = cb;
  return [undefined, function() {}];
}

function useId() {
  var state = getHookState(currentIndex++, 11);
  var mask = [0, 0];
  state[VALUE] = 'P' + mask[0] + '-' + mask[1]++;
  return state[VALUE];
}

function invokeOrReturn(arg, f) {
  return typeof f == 'function' ? f(arg) : f;
}

export {
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useErrorBoundary,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
};
