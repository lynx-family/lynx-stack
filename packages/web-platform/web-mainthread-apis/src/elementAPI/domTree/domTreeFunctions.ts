// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function __AppendElement(
  parent: HTMLElement,
  child: HTMLElement,
): void {
  parent.append(child);
}

export function __ElementIsEqual(
  left: HTMLElement,
  right: HTMLElement,
): boolean {
  return left === right;
}

export function __FirstElement(
  element: HTMLElement,
): HTMLElement | undefined {
  return element.firstElementChild as HTMLElement || undefined;
}

export function __GetChildren(
  element: HTMLElement,
): HTMLElement[] {
  return element.children as unknown as HTMLElement[];
}

export function __GetParent(
  element: HTMLElement,
): HTMLElement | undefined {
  return element.parentElement as HTMLElement || undefined;
}

export function __InsertElementBefore(
  parent: HTMLElement,
  child: HTMLElement,
  ref: HTMLElement | null,
): HTMLElement {
  return parent.insertBefore(child, ref) as HTMLElement;
}

export function __LastElement(
  element: HTMLElement,
): HTMLElement | undefined {
  return element.lastElementChild as HTMLElement || undefined;
}

export function __NextElement(
  element: HTMLElement,
): HTMLElement | undefined {
  return element.nextElementSibling as HTMLElement || undefined;
}

export function __RemoveElement(
  parent: HTMLElement,
  child: HTMLElement,
): HTMLElement {
  parent.removeChild(child);
  return child;
}

export function __ReplaceElement(
  newElement: HTMLElement,
  oldElement: HTMLElement,
) {
  oldElement.replaceWith(newElement);
}

export function __ReplaceElements(
  parent: HTMLElement,
  newChildren: HTMLElement[] | HTMLElement,
  oldChildren: HTMLElement[] | HTMLElement | null | undefined,
) {
  newChildren = Array.isArray(newChildren) ? newChildren : [newChildren];
  if (
    !oldChildren || (Array.isArray(oldChildren) && oldChildren?.length === 0)
  ) {
    parent.append(...newChildren);
  } else {
    oldChildren = Array.isArray(oldChildren) ? oldChildren : [oldChildren];
    for (let ii = 1; ii < oldChildren.length; ii++) {
      __RemoveElement(parent, oldChildren[ii]!);
    }
    const firstOldChildren = oldChildren[0]!;
    firstOldChildren.replaceWith(...newChildren);
  }
}
