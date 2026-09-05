// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The flat op protocol between the background-thread renderer and the fixed
 * main-thread runtime. Each op is a plain array: `[opcode, ...args]`.
 */

/** `[CreateElement, id, tag]` */
export const CreateElement = 1;
/** `[CreateText, id, text]` */
export const CreateText = 2;
/** `[SetText, id, text]` */
export const SetText = 3;
/** `[InsertBefore, parentId, childId, refId]` — `refId === 0` appends. */
export const InsertBefore = 4;
/** `[Remove, parentId, childId]` */
export const Remove = 5;
/** `[SetAttribute, id, key, value]` — `value === null` removes. */
export const SetAttribute = 6;
/** `[SetClasses, id, classes]` */
export const SetClasses = 7;
/** `[SetStyle, id, cssText]` */
export const SetStyle = 8;
/** `[SetId, id, idValue]` */
export const SetId = 9;
/** `[SetDataset, id, dataset]` */
export const SetDataset = 10;
/** `[SetEvent, id, eventType, eventName, enabled]` */
export const SetEvent = 11;
/** `[RegisterWorklet, hash, fnString]` */
export const RegisterWorklet = 12;
/** `[SetWorkletEvent, id, eventType, eventName, hash]` — `hash === 0` removes. */
export const SetWorkletEvent = 13;
/** `[RunWorklet, hash, args]` */
export const RunWorklet = 14;
/** `[AddInlineStyle, id, key, value]` */
export const AddInlineStyle = 15;
/** `[ElementAnimate, id, args]` */
export const ElementAnimate = 16;
/** `[ReportError, message]` */
export const ReportError = 17;

export type Op = unknown[];

/** The id of the page (root container) element. */
export const PAGE_ID = 1;

/** The main-thread global invoked through `callLepusMethod`. */
export const PATCH_METHOD = 'pLynxChange';
