// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { log } from './log.js';

/**
 * Rsbuild sends `{ text, html }`, whereas `webpack-dev-server` sends an array.
 */
export type BuildErrors =
  | { text?: string[]; html?: string }
  | (Error | string)[]
  | undefined;

const MAX_LOGGED_ERRORS = 5;

// The `text` sent by the dev-server keeps the colors it uses in the terminal.
// Lynx consoles do not resolve them, so they would show up as escape sequences.
// eslint-disable-next-line no-control-regex
const SGR_PATTERN = /\u001B\[[0-9;]*m/g;

function toMessages(errors: BuildErrors): string[] {
  const messages = Array.isArray(errors)
    ? errors.map((error) => String(error))
    : errors?.text ?? [];
  return messages.map((message) => message.replace(SGR_PATTERN, ''));
}

function logBuildErrors(errors: BuildErrors): void {
  log.error('Errors while compiling. Reload prevented.');

  const messages = toMessages(errors);

  for (let i = 0; i < messages.length; i++) {
    if (i === MAX_LOGGED_ERRORS) {
      log.error(
        'Additional errors detected. View complete log in terminal for details.',
      );
      break;
    }
    log.error(messages[i]!);
  }
}

export { logBuildErrors };
