/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PageConfig } from './PageConfig.js';
import type { StyleSheetResource } from '../../binary/client/client.js';

/**
 * A decoded Lynx Bundle with its sections parsed into JS objects / blob URLs.
 *
 * @remarks
 * This interface corresponds to the "Bundle" concept in the official Lynx
 * specification. The name `DecodedTemplate` is a legacy artifact.
 *
 * @deprecated Use {@link DecodedBundle} instead. This alias is retained for
 * backward compatibility.
 */
export interface DecodedTemplate {
  config?: PageConfig;
  /**
   * Main Thread Script (MTS) — code that runs on the main thread (UI thread).
   *
   * @remarks
   * In the official Lynx specification this is called "Main Thread Script"
   * (MTS). The field name `lepusCode` is a legacy artifact.
   */
  lepusCode?: Record<string, string>;
  customSections?: Record<string, any>;
  backgroundCode?: Record<string, string>;
  styleSheet?: StyleSheetResource;
}

/**
 * A decoded Lynx Bundle with its sections parsed into JS objects / blob URLs.
 *
 * This is the preferred name for the type previously known as
 * {@link DecodedTemplate}.
 */
export type DecodedBundle = DecodedTemplate;
