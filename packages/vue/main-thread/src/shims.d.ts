// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Lynx Main Thread (Lepus) PAPI declarations for the Vue ops executor.
 * These functions are injected by the Lynx runtime into the main-thread.js
 * global scope.
 */

declare global {
  /** Build-time macros */
  const __DEV__: boolean

  /** Opaque element handle – the actual type is internal to Lynx engine */
  type LynxElement = object

  // -----------------------------------------------------------------------
  // Element creation
  // -----------------------------------------------------------------------
  function __CreatePage(componentId: string, cssId: number): LynxElement
  function __CreateElement(
    tag: string,
    parentComponentUniqueId: number,
    info?: object,
  ): LynxElement
  function __CreateText(parentComponentUniqueId: number): LynxElement
  function __CreateRawText(s: string): LynxElement
  function __CreateView(parentComponentUniqueId: number): LynxElement

  // -----------------------------------------------------------------------
  // Tree manipulation
  // -----------------------------------------------------------------------
  function __AppendElement(
    parent: LynxElement,
    child: LynxElement,
  ): LynxElement
  function __InsertElementBefore(
    parent: LynxElement,
    child: LynxElement,
    ref?: LynxElement,
  ): LynxElement
  function __RemoveElement(
    parent: LynxElement,
    child: LynxElement,
  ): LynxElement

  // -----------------------------------------------------------------------
  // Attribute / style / class / id
  // -----------------------------------------------------------------------
  function __SetAttribute(
    e: LynxElement,
    key: string,
    value: unknown,
  ): void
  function __SetClasses(e: LynxElement, c: string): void
  function __SetInlineStyles(e: LynxElement, value: string | object): void
  function __SetID(e: LynxElement, id: string | null | undefined): void

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------
  function __AddEvent(
    e: LynxElement,
    eventType: string,
    eventName: string,
    event: unknown,
  ): void

  // -----------------------------------------------------------------------
  // Flush
  // -----------------------------------------------------------------------
  function __FlushElementTree(e?: LynxElement): void
}

export {}
