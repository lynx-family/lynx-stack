// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentType } from '@lynx-js/react';

import type { ComponentInstance, Surface } from './types.js';

export class BaseComponentRegistry<T> {
  private registry = new Map<string, T>();
  register(name: string, component: T): void {
    this.registry.set(name, component);
  }
  has(name: string): boolean {
    return this.registry.has(name);
  }
  get(name: string): T | undefined {
    return this.registry.get(name);
  }
}

export interface ComponentProps {
  id: string;
  surfaceId: string;
  surface: Surface;
  /**
   * The full v0.9 component instance as defined by the protocol.
   */
  component: ComponentInstance;
}

export type ComponentRenderer = ComponentType<ComponentProps>;

export class ComponentRegistry
  extends BaseComponentRegistry<ComponentRenderer>
{}

export const componentRegistry = new ComponentRegistry();
