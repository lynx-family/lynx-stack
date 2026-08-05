// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const LYNX_XML_PROTOCOL_VERSION = '1.0';

export interface LynxXmlSections {
  style: string;
  mainThread: string;
  background?: string;
}

export type LynxXmlValidationResult =
  | {
    ok: true;
    source: string;
    sections: LynxXmlSections;
  }
  | {
    ok: false;
    source: string;
    errors: string[];
  };

const DOCTYPE_REGEXP = /<!DOCTYPE\s+lynx\s*>/iy;
const OPENING_TAG_REGEXP = /<(style|script)\b([^>]*)>/iy;
const COMMENT_REGEXP = /<!--(?:.|[\r\n])*?-->/y;

function skipTrivia(source: string, start: number): number {
  let offset = start;
  while (offset < source.length) {
    const whitespace = /^\s+/u.exec(source.slice(offset));
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
      throw new Error(`missing closing </${tagName}> tag`);
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

  throw new Error(`missing closing </${tagName}> tag`);
}

function maskJavaScriptCharacter(value: string): string {
  return value === '\n' || value === '\r' ? value : ' ';
}

function maskJavaScriptStringsAndComments(source: string): string {
  let output = '';
  let offset = 0;

  while (offset < source.length) {
    const current = source[offset]!;
    const next = source[offset + 1];

    if (current === '/' && next === '/') {
      output += '  ';
      offset += 2;
      while (offset < source.length && source[offset] !== '\n') {
        output += ' ';
        offset += 1;
      }
      continue;
    }

    if (current === '/' && next === '*') {
      output += '  ';
      offset += 2;
      while (offset < source.length) {
        if (source[offset] === '*' && source[offset + 1] === '/') {
          output += '  ';
          offset += 2;
          break;
        }
        output += maskJavaScriptCharacter(source[offset]!);
        offset += 1;
      }
      continue;
    }

    if (current === '\'' || current === '"' || current === '`') {
      const quote = current;
      output += ' ';
      offset += 1;
      while (offset < source.length) {
        const value = source[offset]!;
        output += maskJavaScriptCharacter(value);
        offset += 1;
        if (value === '\\' && offset < source.length) {
          output += maskJavaScriptCharacter(source[offset]!);
          offset += 1;
          continue;
        }
        if (value === quote) break;
      }
      continue;
    }

    output += current;
    offset += 1;
  }

  return output;
}

function usesReactOrJsx(source: string): boolean {
  const code = maskJavaScriptStringsAndComments(source);
  if (/\bReact(?:DOM)?\b|\b(?:jsx|jsxs|jsxDEV)\s*\(/u.test(code)) {
    return true;
  }

  return /<\/?(?:[A-Z][\w.]*|view|text|image|scroll-view|list|page|div|span|img|button)(?=[\s/>])/u
    .test(code);
}

/** Remove the Markdown fence that some model providers add around XML. */
export function normalizeLynxXmlOutput(output: string): string {
  const trimmed = output.trim().replace(/^\uFEFF/u, '');
  if (!trimmed.startsWith('```') || !trimmed.endsWith('\n```')) {
    return trimmed;
  }

  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) return trimmed;
  const language = trimmed.slice(3, firstNewline).trim().toLowerCase();
  if (language !== '' && !['html', 'lynx', 'xml'].includes(language)) {
    return trimmed;
  }
  return trimmed.slice(firstNewline + 1, -4).trim();
}

/**
 * Parse the zero-build Lynx XML format consumed by `@lynx-js/web-core`.
 * The format is HTML-like because script thread markers are boolean
 * attributes rather than well-formed XML attributes.
 */
export function parseLynxXml(source: string): LynxXmlSections {
  let offset = source.charCodeAt(0) === 0xFEFF ? 1 : 0;
  offset = skipTrivia(source, offset);

  DOCTYPE_REGEXP.lastIndex = offset;
  if (!DOCTYPE_REGEXP.exec(source)) {
    throw new Error('expected <!DOCTYPE lynx>');
  }
  offset = DOCTYPE_REGEXP.lastIndex;

  let style: string | undefined;
  let mainThread: string | undefined;
  let background: string | undefined;

  while (true) {
    offset = skipTrivia(source, offset);
    if (offset === source.length) break;

    OPENING_TAG_REGEXP.lastIndex = offset;
    const openingTag = OPENING_TAG_REGEXP.exec(source);
    if (!openingTag) {
      throw new Error(`unexpected content at offset ${offset}`);
    }

    const tagName = openingTag[1]!.toLowerCase() as 'style' | 'script';
    const attributes = openingTag[2]!.trim().toLowerCase();
    const section = findClosingTag(
      source,
      tagName,
      OPENING_TAG_REGEXP.lastIndex,
    );

    if (tagName === 'style') {
      if (attributes) throw new Error('<style> does not accept attributes');
      if (style !== undefined) throw new Error('duplicate <style> section');
      style = section.content;
    } else if (attributes === 'main-thread') {
      if (mainThread !== undefined) {
        throw new Error('duplicate <script main-thread> section');
      }
      mainThread = section.content;
    } else if (attributes === 'background') {
      if (background !== undefined) {
        throw new Error('duplicate <script background> section');
      }
      background = section.content;
    } else {
      throw new Error(
        '<script> requires exactly one main-thread or background attribute',
      );
    }
    offset = section.end;
  }

  if (style === undefined) throw new Error('missing <style> section');
  if (mainThread === undefined) {
    throw new Error('missing <script main-thread> section');
  }

  return {
    style,
    mainThread,
    ...(background === undefined ? {} : { background }),
  };
}

export function validateLynxXml(output: string): LynxXmlValidationResult {
  const source = normalizeLynxXmlOutput(output);
  let sections: LynxXmlSections;
  try {
    sections = parseLynxXml(source);
  } catch (error) {
    return {
      ok: false,
      source,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  const errors: string[] = [];
  if (!sections.style.trim()) errors.push('<style> must not be empty');
  if (!sections.mainThread.includes('__CreatePage')) {
    errors.push('main-thread script must create the page with __CreatePage');
  }
  if (!sections.mainThread.includes('__AppendElement')) {
    errors.push('main-thread script must build a tree with __AppendElement');
  }
  if (!/globalThis\.renderPage\s*=/u.test(sections.mainThread)) {
    errors.push('main-thread script must assign globalThis.renderPage');
  }
  if (/\b(?:document|window)\s*\./u.test(sections.mainThread)) {
    errors.push('main-thread script must not use browser DOM globals');
  }
  if (usesReactOrJsx(sections.mainThread)) {
    errors.push(
      'main-thread script must use Element PAPI instead of React/JSX',
    );
  }
  if (
    sections.background !== undefined
    && !sections.background.includes('lynx.getCoreContext()')
  ) {
    errors.push(
      'background script must communicate through lynx.getCoreContext()',
    );
  }

  return errors.length === 0
    ? { ok: true, source, sections }
    : { ok: false, source, errors };
}
