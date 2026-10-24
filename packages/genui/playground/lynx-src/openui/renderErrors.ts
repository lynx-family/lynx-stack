// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const OPENUI_RENDER_ERRORS_MESSAGE_TYPE = 'OPENUI_RENDER_ERRORS';

/** Serializable renderer diagnostics, including future upstream error codes. */
export interface OpenUIRenderError {
  source: string;
  code: string;
  message: string;
  statementId?: string;
  component?: string;
  path?: string;
  toolName?: string;
  hint?: string;
}

export function readOpenUIRenderErrors(payload: unknown):
  | OpenUIRenderError[]
  | null
{
  if (!payload || typeof payload !== 'object' || !('errors' in payload)) {
    return null;
  }
  const { errors } = payload;
  if (!Array.isArray(errors)) return null;
  const valid = errors.every((error: unknown) => {
    if (!error || typeof error !== 'object') return false;
    const value = error as Record<string, unknown>;
    return ['source', 'code', 'message'].every((key) =>
      typeof value[key] === 'string' && value[key].length > 0
    ) && ['statementId', 'component', 'path', 'toolName', 'hint'].every((key) =>
      value[key] === undefined || typeof value[key] === 'string'
    );
  });
  return valid ? errors as OpenUIRenderError[] : null;
}

export function formatOpenUIRenderErrors(
  errors: readonly OpenUIRenderError[],
): string {
  return errors.map((error) => {
    const location = [error.statementId, error.component, error.path]
      .filter(Boolean).join(' · ');
    return `[${error.source}/${error.code}] ${
      location ? `${location}: ` : ''
    }${error.message}${error.hint ? `\n${error.hint}` : ''}`;
  }).join('\n\n');
}
