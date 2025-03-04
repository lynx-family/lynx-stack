// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createContext, createRef } from 'preact';
import { lazy } from 'preact/compat';

import {
  ComponentFromReactRuntime as Component,
  ComponentFromReactRuntime as PureComponent,
} from '../compat/lynxComponent.js';
import { useCallback, useEffect, useMemo, useReducer, useState, useRef } from '../hooks/react.js';

/* v8 ignore next 3 */
function __runInJS<T>(value: T): T | undefined | null {
  return value;
}

// should mirror @lynx-js/react-runtime's exports
export { ComponentFromReactRuntime as Component } from '../compat/lynxComponent.js';
export { ComponentFromReactRuntime as PureComponent } from '../compat/lynxComponent.js';
export { createContext } from 'preact';
export { lazy } from 'preact/compat';
export { useState, useReducer, useEffect, useMemo, useCallback /*, useInstance */ } from '../hooks/react.js';
export { __runInJS };

/**
 * @internal
 */
export default {
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
};
