// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export class ComponentRegistry<T> {
  private components = new Map<string, T>();

  register(tag: string, component: T) {
    this.components.set(tag, component);
  }

  get(tag: string): T | undefined {
    return this.components.get(tag);
  }

  has(tag: string): boolean {
    return this.components.has(tag);
  }
}
