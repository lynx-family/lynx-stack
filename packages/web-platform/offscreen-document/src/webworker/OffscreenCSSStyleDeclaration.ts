import {
  ancestorDocument,
  uniqueId,
  type OffscreenElement,
} from './OffscreenElement.js';
import { operations } from './OffscreenDocument.js';
import { OperationType } from '../types/ElementOperation.js';

const _parent = Symbol('_parent');
export class OffscreenCSSStyleDeclaration {
  /**
   * @private
   */
  readonly [_parent]: OffscreenElement;

  constructor(parent: OffscreenElement) {
    this[_parent] = parent;
  }

  setProperty(
    property: string,
    value: string,
    priority?: 'important' | undefined | '',
  ): void {
    this[_parent][ancestorDocument][operations].push({
      type: OperationType['StyleDeclarationSetProperty'],
      uid: this[_parent][uniqueId],
      property,
      value: value,
      priority: priority,
    });
  }

  removeProperty(property: string): void {
    this[_parent][ancestorDocument][operations].push({
      type: OperationType['StyleDeclarationRemoveProperty'],
      uid: this[_parent][uniqueId],
      property,
    });
  }
}
