// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface LynxMarkup {
  style?: string;
  mainThread?: string;
  background?: string;
}

const DOCTYPE_REGEXP = /<!DOCTYPE\s+lynx\s*>/iy;
const OPENING_TAG_REGEXP = /<(style|script)\b([^>]*)>/iy;
const COMMENT_REGEXP = /<!--(?:.|[\r\n])*?-->/y;

function fail(message: string): never {
  throw new Error(`Invalid Lynx markup: ${message}`);
}

function skipTrivia(source: string, start: number): number {
  let offset = start;
  while (offset < source.length) {
    const whitespace = /^\s+/.exec(source.slice(offset));
    if (whitespace) {
      offset += whitespace[0].length;
      continue;
    }

    COMMENT_REGEXP.lastIndex = offset;
    const comment = COMMENT_REGEXP.exec(source);
    if (comment) {
      offset = COMMENT_REGEXP.lastIndex;
      continue;
    }
    break;
  }
  return offset;
}

function findClosingTag(
  source: string,
  tagName: 'style' | 'script',
  contentStart: number,
): { content: string; end: number } {
  const closingTag = new RegExp(`</${tagName}\\s*>`, 'iy');
  let searchFrom = contentStart;

  while (searchFrom < source.length) {
    const candidate = source.toLowerCase().indexOf(
      `</${tagName}`,
      searchFrom,
    );
    if (candidate === -1) {
      fail(`missing closing </${tagName}> tag`);
    }

    closingTag.lastIndex = candidate;
    const match = closingTag.exec(source);
    if (match) {
      return {
        content: source.slice(contentStart, candidate),
        end: closingTag.lastIndex,
      };
    }
    searchFrom = candidate + tagName.length + 2;
  }

  fail(`missing closing </${tagName}> tag`);
}

/**
 * Parse the Lynx-specific markup artifact used by the web platform.
 *
 * This format is HTML-like rather than well-formed XML because its script
 * thread markers are boolean attributes (`<script main-thread>` and
 * `<script background>`). Keep this parser independent of DOM APIs so it can
 * run in the template decode worker.
 */
export function parseLynxMarkup(source: string): LynxMarkup {
  let offset = source.charCodeAt(0) === 0xFEFF ? 1 : 0;
  offset = skipTrivia(source, offset);

  DOCTYPE_REGEXP.lastIndex = offset;
  if (!DOCTYPE_REGEXP.exec(source)) {
    fail('expected <!doctype lynx>');
  }
  offset = DOCTYPE_REGEXP.lastIndex;

  const result: LynxMarkup = {};
  let sectionCount = 0;

  while (true) {
    offset = skipTrivia(source, offset);
    if (offset === source.length) {
      break;
    }

    OPENING_TAG_REGEXP.lastIndex = offset;
    const openingTag = OPENING_TAG_REGEXP.exec(source);
    if (!openingTag) {
      fail(`unexpected content at offset ${offset}`);
    }

    const tagName = openingTag[1]!.toLowerCase() as 'style' | 'script';
    const attributes = openingTag[2]!.trim().toLowerCase();
    const section = findClosingTag(
      source,
      tagName,
      OPENING_TAG_REGEXP.lastIndex,
    );

    if (tagName === 'style') {
      if (attributes.length > 0) {
        fail('<style> does not accept attributes');
      }
      if (result.style !== undefined) {
        fail('duplicate <style> section');
      }
      result.style = section.content;
    } else if (attributes === 'main-thread') {
      if (result.mainThread !== undefined) {
        fail('duplicate <script main-thread> section');
      }
      result.mainThread = section.content;
    } else if (attributes === 'background') {
      if (result.background !== undefined) {
        fail('duplicate <script background> section');
      }
      result.background = section.content;
    } else {
      fail(
        '<script> requires exactly one main-thread or background attribute',
      );
    }

    sectionCount += 1;
    offset = section.end;
  }

  if (sectionCount === 0) {
    fail('expected at least one style or script section');
  }
  return result;
}
