// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
class IndexMap<T> {
  protected lastIndex = 0;
  protected indexMap: Map<number, T> = new Map<number, T>();

  public add(value: T): number {
    const index = ++this.lastIndex;
    this.indexMap.set(index, value);
    return index;
  }

  public get(index: number): T | undefined {
    return this.indexMap.get(index);
  }

  public remove(index: number): void {
    this.indexMap.delete(index);
  }
}

export { IndexMap };
