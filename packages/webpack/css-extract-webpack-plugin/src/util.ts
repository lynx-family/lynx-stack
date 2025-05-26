// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import type { LoaderOptions } from 'mini-css-extract-plugin';
import type { LoaderContext } from 'webpack';

export function isAbsolutePath(str: string): boolean {
  return path.posix.isAbsolute(str) || path.win32.isAbsolute(str);
}

const RELATIVE_PATH_REGEXP = /^\.\.?[/\\]/;

export function isRelativePath(str: string): boolean {
  return RELATIVE_PATH_REGEXP.test(str);
}

export function stringifyRequest(
  loaderContext: LoaderContext<LoaderOptions>,
  request: string,
): string {
  if (
    typeof loaderContext.utils !== 'undefined'
    && typeof loaderContext.utils.contextify === 'function'
  ) {
    return JSON.stringify(
      loaderContext.utils.contextify(
        loaderContext.context || loaderContext.rootContext,
        request,
      ),
    );
  }

  const split = request.split('!');
  const { context } = loaderContext;

  return JSON.stringify(
    split
      .map((part: string) => {
        // First, separate singlePath from query, because the query might contain paths again
        const splitPart = /^(.*?)(\?.*)/.exec(part);
        const query = splitPart ? splitPart[2] : '';
        let singlePath = splitPart ? splitPart[1] : part;

        if (isAbsolutePath(singlePath!) && context) {
          singlePath = path.relative(context, singlePath!);

          if (isAbsolutePath(singlePath)) {
            // If singlePath still matches an absolute path, singlePath was on a different drive than context.
            // In this case, we leave the path platform-specific without replacing any separators.
            // @see https://github.com/webpack/loader-utils/pull/14
            return singlePath + query;
          }

          if (isRelativePath(singlePath) === false) {
            // Ensure that the relative path starts at least with ./ otherwise it would be a request into the modules directory (like node_modules).
            singlePath = `./${singlePath}`;
          }
        }

        return singlePath!.replace(/\\/g, '/') + query;
      })
      .join('!'),
  );
}

/**
 * Extract file path from the identifier.
 *
 * @example
 *
 * Given identifier `css-loader/index.js??ruleSet[1].rules[1].use[1]!./src/baz.css`,
 * result in `./src/baz.css`
 *
 * Given identifier `css-loader/index.js??ruleSet[1].rules[1].use[1]!./src/baz.css?cssId=123`, and the withPathQuery is false
 * result in `./src/baz.css`
 *
 * Given identifier `css-loader/index.js??ruleSet[1].rules[1].use[1]!./src/baz.css?cssId=123`, and the withPathQuery is true
 * result in `./src/baz.css?cssId=123`
 *
 * @param identifier - The Webpack/Rspack identifier
 * @param withPathQuery - Whether keep the query(e.g: ?xxx=xx) in the path
 * @returns The resourcePath of the identifier.
 */
export function extractPathFromIdentifier(
  identifier: string,
  withPathQuery = false,
): string | undefined {
  const regex = withPathQuery ? /!([^!]+)$/ : /!([^!?]+)(?:\?[^!]*)?$/;
  const matches = regex.exec(identifier);
  return matches?.[1];
}
