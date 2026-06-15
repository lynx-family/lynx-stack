// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  createLibrary as coreCreateLibrary,
  defineComponent as coreDefineComponent,
} from '@openuidev/lang-core';
import type {
  ActionEvent as CoreActionEvent,
  DefinedComponent as CoreDefinedComponent,
  Library as CoreLibrary,
  LibraryDefinition as CoreLibraryDefinition,
  ComponentRenderProps as CoreRenderProps,
} from '@openuidev/lang-core';
import type { z } from 'zod/v4';
import type { $ZodObject } from 'zod/v4/core';

import type { ReactNode } from '@lynx-js/react';

// Re-export framework-agnostic types unchanged
export type {
  ComponentGroup,
  LibraryJSONSchema,
  PromptOptions,
  SubComponentOf,
  ToolDescriptor,
} from '@openuidev/lang-core';

// ─── React-specific types ───────────────────────────────────────────────────

/**
 * Props passed to an OpenUI ReactLynx component renderer.
 */
export interface ComponentRenderProps<P = Record<string, unknown>>
  extends CoreRenderProps<P, ReactNode>
{
  onAction?: (event: CoreActionEvent) => void;
}

export type ComponentRenderer<P = Record<string, unknown>> = React.FC<
  ComponentRenderProps<P>
>;

export type DefinedComponent<T extends $ZodObject = $ZodObject> =
  CoreDefinedComponent<
    T,
    ComponentRenderer<z.infer<T>>
  >;

export type Library = CoreLibrary<ComponentRenderer<any>>;

export type LibraryDefinition = CoreLibraryDefinition<ComponentRenderer<any>>;

// ─── defineComponent (React) ────────────────────────────────────────────────

/**
 * Define a ReactLynx component renderer and its OpenUI schema metadata.
 */
export function defineComponent<T extends $ZodObject>(config: {
  name: string;
  props: T;
  description: string;
  component: ComponentRenderer<z.infer<T>>;
}): DefinedComponent<T> {
  return coreDefineComponent<T, ComponentRenderer<z.infer<T>>>(config);
}

// ─── createLibrary (React) ──────────────────────────────────────────────────

/**
 * Create a typed OpenUI library from ReactLynx component definitions.
 *
 * @internal
 */
export function createLibrary(input: LibraryDefinition): Library {
  return coreCreateLibrary<ComponentRenderer<any>>(input) as Library;
}

export type RenderOutput = JSX.Element | JSX.Element[] | null;
