// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ancestorDocument, type OffscreenElement } from './OffscreenElement.js';
import { operations } from './OffscreenDocument.js';
import { OperationType } from '../types/ElementOperation.js';
import { uniqueId } from './OffscreenNode.js';

export class OffscreenCSSStyleDeclaration {
  /**
   * @private
   */
  private readonly _parent: OffscreenElement;

  constructor(parent: OffscreenElement) {
    this._parent = parent;
  }

  setProperty(
    property: string,
    value: string,
    priority?: 'important' | undefined | '',
  ): void {
    this._parent[ancestorDocument][operations].push({
      type: OperationType['StyleDeclarationSetProperty'],
      uid: this._parent[uniqueId],
      property,
      value: value,
      priority: priority,
    });
  }

  removeProperty(property: string): void {
    this._parent[ancestorDocument][operations].push({
      type: OperationType['StyleDeclarationRemoveProperty'],
      uid: this._parent[uniqueId],
      property,
    });
  }
}
