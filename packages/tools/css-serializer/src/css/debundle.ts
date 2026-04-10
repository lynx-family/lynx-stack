// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as cssTree from 'css-tree';

// `COMMON_CSS` is the global styles that applies to all the elements.
// It should always has `cssId: 0`.
const COMMON_CSS = '/common.css';
const COMMON_CSS_ID = 0;

interface CSSPosition {
  column: number;
  line: number;
  offset: number;
}

interface CSSSegment {
  content: string;
  start: CSSPosition;
}

export function debundleCSS(
  code: string,
  css: Map<number, string[]>,
  enableCSSSelector: boolean,
  preserveLocations: boolean = false,
): void {
  const ast = cssTree.parse(code, {
    positions: preserveLocations,
  });

  const fileKeyToCSSSegments = new Map<string, CSSSegment[]>();
  const fileKeyToCSSContent = new Map<string, string>();
  const cssIdToFileKeys = new Map<number, Set<string>>();
  const fileKeyToCSSId = new Map<string, number>([[COMMON_CSS, COMMON_CSS_ID]]);

  cssTree.walk(ast, {
    visit: 'Atrule',
    enter(node, item, list) {
      if (
        node.type === 'Atrule' && node.prelude
        && node.prelude.type === 'AtrulePrelude' // Minify/Format will change `cssId` to `cssid`.
        && node.name.toLowerCase() === 'cssId'.toLowerCase()
      ) {
        // @cssId "842372" "foo.css" {}
        const [cssIdNode, fileKeyNode] = node.prelude.children.toArray()
          .filter(({ type }) => type !== 'WhiteSpace');
        if (
          cssIdNode?.type === 'String'
          && fileKeyNode?.type === 'String'
          && node.block
        ) {
          const cssId = Number(cssIdNode.value);

          if (Number.isNaN(cssId)) {
            throw new Error(
              `Invalid cssId: @cssId "${cssIdNode.value}" "${fileKeyNode.value}"`,
            );
          }

          const fileKey = fileKeyNode.value;

          let fileKeys = cssIdToFileKeys.get(cssId);
          if (typeof fileKeys === 'undefined') {
            // Every file should import COMMON_CSS(cssId: 0).
            // Otherwise, the global styles cannot be resolved by elements.
            fileKeys = new Set([COMMON_CSS]);
            cssIdToFileKeys.set(cssId, fileKeys);
          }
          fileKeys.add(fileKey);
          if (preserveLocations) {
            if (!fileKeyToCSSSegments.has(fileKey)) {
              fileKeyToCSSSegments.set(
                fileKey,
                getBlockSegments(code, node.block),
              );
            }
          } else if (!fileKeyToCSSContent.has(fileKey)) {
            fileKeyToCSSContent.set(
              fileKey,
              cssTree.generate({
                type: 'StyleSheet',
                children: node.block.children,
              }),
            );
          }
        }
        list.remove(item);
      }
    },
  });

  // If there are Rules left in the AST(e.g.: some rules that are not in `@file {}`),
  // we treat them as global styles. Global styles should be added to COMMON_CSS(cssId: 0).
  const commonCss = preserveLocations
    ? buildStylesheetFromSegments(getTopLevelSegments(code, ast))
    : cssTree.generate(ast);
  if (commonCss) {
    emplaceCSSStyleSheet(css, COMMON_CSS_ID, commonCss);
  }

  // TODO: resolve conflict with scoped cssId
  //   E.g.: we may generate a cssId hash that is equal to the index of source files.
  //
  // For each CSS source file, we create a CSSStyleSheet.
  // The scoped CSSStyleSheet will use `@import` to reference all the imported CSSStyleSheets.
  //
  // Note that the `Map.prototype.keys()` returns an iterator in insertion order.
  // This will make sure that the stylesheets are created in the same order of CSS.
  const fileKeys = preserveLocations
    ? Array.from(fileKeyToCSSSegments.keys())
    : Array.from(fileKeyToCSSContent.keys());

  fileKeys.forEach((fileKey, index) => {
    // Starts from 1
    // 0 is the common CSS
    index = index + 1;
    fileKeyToCSSId.set(fileKey, index);
    emplaceCSSStyleSheet(
      css,
      index,
      preserveLocations
        ? buildStylesheetFromSegments(fileKeyToCSSSegments.get(fileKey)!)
        : fileKeyToCSSContent.get(fileKey)!,
    );
  });
  // TODO: remove /cssId/0.css if not exists in the cssMap

  // For each scoped CSSStyleSheet, we should import the real CSSStyleSheet.
  // So that the styles can be resolved with the scoped cssId.
  cssIdToFileKeys.forEach((rawFileKeys, cssId) => {
    let fileKeys = Array.from(rawFileKeys);
    if (enableCSSSelector === false) {
      // When enableCSSSelector is false, style rule priority is inversely related to @import order,
      // requiring reversed imports to maintain correct priority.
      fileKeys = fileKeys.reverse();
    }
    emplaceCSSStyleSheet(
      css,
      cssId,
      Array.from(fileKeys).map(fileKey =>
        `@import "${fileKeyToCSSId.get(fileKey)}";`
      ).join('\n'),
    );
  });
}

function getBlockSegments(
  code: string,
  block: cssTree.Block,
): CSSSegment[] {
  const children = block.children.toArray();

  if (children.length === 0) {
    return [];
  }

  const firstChildLoc = getLoc(children[0]!);
  const lastChildLoc = getLoc(children[children.length - 1]!);

  return [{
    content: code.slice(firstChildLoc.start.offset, lastChildLoc.end.offset),
    start: firstChildLoc.start,
  }];
}

function getTopLevelSegments(
  code: string,
  ast: cssTree.CssNode,
): CSSSegment[] {
  if (ast.type !== 'StyleSheet') {
    return [];
  }

  return ast.children.toArray().map((node) => {
    const loc = getLoc(node);
    return {
      content: code.slice(loc.start.offset, loc.end.offset),
      start: loc.start,
    };
  });
}

function buildStylesheetFromSegments(segments: CSSSegment[]): string {
  let result = '';
  let line = 1;
  let column = 1;

  for (const segment of segments) {
    const lineBreaks = Math.max(segment.start.line - line, 0);
    if (lineBreaks > 0) {
      result += '\n'.repeat(lineBreaks);
      line += lineBreaks;
      column = 1;
    }

    const spaces = Math.max(segment.start.column - column, 0);
    if (spaces > 0) {
      result += ' '.repeat(spaces);
      column += spaces;
    }

    result += segment.content;
    ({ line, column } = getPositionAfterContent(line, column, segment.content));
  }

  return result;
}

function getPositionAfterContent(
  line: number,
  column: number,
  content: string,
): Pick<CSSPosition, 'line' | 'column'> {
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function getLoc(node: cssTree.CssNode): {
  end: CSSPosition;
  start: CSSPosition;
} {
  const loc = node.loc;
  if (!loc) {
    throw new Error('Expected css node location to exist.');
  }

  return {
    start: loc.start as CSSPosition,
    end: loc.end as CSSPosition,
  };
}

function emplaceCSSStyleSheet<K, V>(map: Map<K, V[]>, key: K, value: V) {
  if (map.has(key)) {
    map.get(key)!.push(value);
  } else {
    map.set(key, [value]);
  }
}
