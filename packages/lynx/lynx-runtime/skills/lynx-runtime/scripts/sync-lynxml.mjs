#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(scriptDir, '../../..');
const pkg = JSON.parse(
  fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'),
);
const version = pkg.version;

const THREAD_ENTRIES = {
  main: {
    attr: 'main',
    entry: 'mts',
    iifePath: path.join(pkgRoot, 'dist/iife/mts.js'),
  },
  background: {
    attr: 'background',
    entry: 'bts',
    iifePath: path.join(pkgRoot, 'dist/iife/bts.js'),
  },
};

const RAW_LYNX_MEMBERS = new Set([
  'getEngine',
  'getJSContext',
  'getCoreContext',
  '__globalProps',
]);
const MTS_RESERVED_GLOBALS = new Set([
  'renderPage',
  'updatePage',
  'updateGlobalProps',
  'processData',
  'getPageData',
  'removeComponents',
]);
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return',
  'case',
  'throw',
  'else',
  'do',
  'in',
  'instanceof',
  'typeof',
  'void',
  'delete',
  'new',
  'of',
  'yield',
  'await',
]);

function isASCIIWhitespace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
    || ch === '\f';
}

function trimASCIIWhitespace(value) {
  let start = 0;
  let end = value.length;
  while (start < end && isASCIIWhitespace(value[start])) start += 1;
  while (end > start && isASCIIWhitespace(value[end - 1])) end -= 1;
  return value.slice(start, end);
}

function isQuotedAttribute(attributes, attributeName, expectedValue) {
  if (!attributes.startsWith(attributeName)) return false;
  let rest = trimASCIIWhitespace(attributes.slice(attributeName.length));
  if (rest.length === 0 || rest[0] !== '=') return false;
  rest = trimASCIIWhitespace(rest.slice(1));
  const quote = rest[0];
  if (rest.length < 3 || (quote !== '"' && quote !== '\'')) return false;
  const closingQuote = rest.indexOf(quote, 1);
  if (closingQuote !== rest.length - 1 || closingQuote <= 1) return false;
  return expectedValue === undefined
    || rest.slice(1, closingQuote) === expectedValue;
}

function isOpeningTag(source, position, tagName) {
  if (
    position >= source.length || source[position] !== '<'
    || !source.startsWith(tagName, position + 1)
  ) {
    return false;
  }
  const boundary = position + tagName.length + 1;
  return boundary < source.length
    && (source[boundary] === '>' || isASCIIWhitespace(source[boundary]));
}

/**
 * Top-level LynxML scanner matching the host parser's root, comment, `<style>`,
 * and `<script thread="main|background">` grammar so comments and attribute
 * whitespace/quoting cannot cause missed or misdirected updates.
 */
function parseLynxScriptBlocks(source, filePath) {
  let pos = source.startsWith('\uFEFF') ? 1 : 0;

  function fail(offset, message) {
    throw new Error(
      `${filePath}: invalid .lynxml at offset ${offset}: ${message}`,
    );
  }

  function consumeIgnorable() {
    for (;;) {
      while (pos < source.length && isASCIIWhitespace(source[pos])) pos += 1;
      if (!source.startsWith('<!--', pos)) return;
      const end = source.indexOf('-->', pos + 4);
      if (end === -1) fail(pos, 'unterminated XML comment');
      pos = end + 3;
    }
  }

  consumeIgnorable();
  if (source.startsWith('<!', pos)) {
    if (!source.startsWith('<!doctype lynx>', pos)) {
      fail(pos, 'expected \'<!doctype lynx>\'');
    }
    pos += '<!doctype lynx>'.length;
    consumeIgnorable();
  }

  if (!isOpeningTag(source, pos, 'lynx')) {
    fail(pos, 'expected \'<lynx engine-version="...">\' root element');
  }
  const rootTagEnd = source.indexOf('>', pos + 1);
  if (rootTagEnd === -1) fail(pos, 'unterminated \'<lynx>\' opening tag');
  const rootTag = trimASCIIWhitespace(source.slice(pos + 1, rootTagEnd));
  const rootNameEnd = rootTag.search(/[\t\n\f\r ]/);
  const rootAttrs = rootNameEnd === -1
    ? ''
    : trimASCIIWhitespace(rootTag.slice(rootNameEnd));
  if (!isQuotedAttribute(rootAttrs, 'engine-version')) {
    fail(pos, '\'<lynx>\' requires a non-empty \'engine-version\' attribute');
  }
  pos = rootTagEnd + 1;

  let seenStyle = false;
  const seenScripts = new Map();
  let rootClosed = false;

  for (;;) {
    consumeIgnorable();
    if (source.startsWith('</lynx>', pos)) {
      pos += '</lynx>'.length;
      rootClosed = true;
      break;
    }
    if (pos === source.length) break;
    if (source[pos] !== '<') fail(pos, 'unexpected content outside a section');

    const tagEnd = source.indexOf('>', pos + 1);
    if (tagEnd === -1) fail(pos, 'unterminated opening tag');
    const openingTag = trimASCIIWhitespace(source.slice(pos + 1, tagEnd));
    if (openingTag.length === 0 || openingTag[0] === '/') {
      fail(pos, 'unexpected closing tag');
    }
    const nameEnd = openingTag.search(/[\t\n\f\r ]/);
    const tagName = nameEnd === -1 ? openingTag : openingTag.slice(0, nameEnd);
    const attrs = nameEnd === -1
      ? ''
      : trimASCIIWhitespace(openingTag.slice(nameEnd));

    const contentStart = tagEnd + 1;
    if (tagName === 'style') {
      if (attrs.length > 0) {
        fail(pos, '\'<style>\' does not accept attributes');
      }
      if (seenStyle) fail(pos, 'duplicate \'<style>\' section');
      const closeIdx = source.indexOf('</style>', contentStart);
      if (closeIdx === -1) {
        fail(contentStart, 'missing closing tag \'</style>\'');
      }
      if (
        trimASCIIWhitespace(source.slice(contentStart, closeIdx)).startsWith(
          '<![CDATA[',
        )
      ) {
        fail(contentStart, 'CDATA sections are not supported');
      }
      seenStyle = true;
      pos = closeIdx + '</style>'.length;
      continue;
    }

    if (tagName === 'script') {
      let thread = null;
      if (isQuotedAttribute(attrs, 'thread', 'main')) {
        thread = 'main';
      } else if (isQuotedAttribute(attrs, 'thread', 'background')) {
        thread = 'background';
      } else {
        fail(
          pos,
          '\'<script>\' requires thread="main" or thread="background"',
        );
      }
      if (seenScripts.has(thread)) {
        fail(pos, `duplicate '<script thread="${thread}">' section`);
      }
      const closeIdx = source.indexOf('</script>', contentStart);
      if (closeIdx === -1) {
        fail(contentStart, 'missing closing tag \'</script>\'');
      }
      const body = source.slice(contentStart, closeIdx);
      if (trimASCIIWhitespace(body).startsWith('<![CDATA[')) {
        fail(contentStart, 'CDATA sections are not supported');
      }
      seenScripts.set(thread, {
        ...THREAD_ENTRIES[thread],
        bodyStart: contentStart,
        bodyEnd: closeIdx,
        body,
      });
      pos = closeIdx + '</script>'.length;
      continue;
    }

    fail(pos, `unsupported top-level tag '<${tagName}>'`);
  }

  if (!rootClosed) fail(pos, 'missing closing tag \'</lynx>\'');
  consumeIgnorable();
  if (pos !== source.length) fail(pos, 'unexpected content after \'</lynx>\'');
  if (!seenScripts.has('main')) {
    fail(pos, 'missing \'<script thread="main">\' section');
  }

  return [...seenScripts.values()];
}

function isIdentStart(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
    || ch === '$';
}

function isIdentPart(ch) {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

function canStartRegex(prevToken) {
  if (!prevToken) return true;
  if (prevToken.type === 'ident') {
    return REGEX_PRECEDING_KEYWORDS.has(prevToken.value);
  }
  if (prevToken.type === 'punct') {
    return prevToken.value !== ')' && prevToken.value !== ']';
  }
  return false;
}

/**
 * Zero-dependency JS scanner used for directive-prologue detection, unmarked
 * runtime checks, and syntax-aware raw host API / top-level hook validation.
 */
function tokenizeJs(source) {
  const tokens = [];
  const templateBraceStack = [];
  let i = 0;
  let lineBreakBefore = false;

  while (i < source.length) {
    const ch = source[i];
    if (ch === '\n' || ch === '\r') {
      lineBreakBefore = true;
      i += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\f' || ch === '\v') {
      i += 1;
      continue;
    }

    // Line comment
    if (ch === '/' && source[i + 1] === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n' && source[i] !== '\r') {
        i += 1;
      }
      continue;
    }

    // Block comment
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (
        i < source.length && !(source[i] === '*' && source[i + 1] === '/')
      ) {
        if (source[i] === '\n' || source[i] === '\r') lineBreakBefore = true;
        i += 1;
      }
      i = Math.min(i + 2, source.length);
      continue;
    }

    // String literal
    if (ch === '\'' || ch === '"') {
      const start = i;
      const quote = ch;
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i += 1;
        i += 1;
      }
      if (i < source.length) i += 1;
      tokens.push({
        type: 'string',
        value: source.slice(start + 1, Math.max(start + 1, i - 1)),
        raw: source.slice(start, i),
        start,
        end: i,
        lineBreakBefore,
      });
      lineBreakBefore = false;
      continue;
    }

    // Template literal start or continuation after `${ ... }`
    if (
      ch === '`'
      || (ch === '}' && templateBraceStack.length > 0
        && templateBraceStack[templateBraceStack.length - 1] === 0)
    ) {
      const start = i;
      const isResume = ch === '}';
      if (isResume) {
        templateBraceStack.pop();
        tokens.push({
          type: 'punct',
          value: '}',
          start,
          end: i + 1,
          lineBreakBefore,
        });
        lineBreakBefore = false;
      }
      i += 1;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === '`') {
          i += 1;
          break;
        }
        if (source[i] === '$' && source[i + 1] === '{') {
          templateBraceStack.push(0);
          tokens.push({
            type: 'template',
            value: source.slice(start, i),
            start,
            end: i,
            lineBreakBefore,
          });
          tokens.push({
            type: 'punct',
            value: '{',
            start: i + 1,
            end: i + 2,
            lineBreakBefore: false,
          });
          lineBreakBefore = false;
          i += 2;
          break;
        }
        i += 1;
      }
      if (
        tokens.length === 0
        || tokens[tokens.length - 1].end < i
      ) {
        tokens.push({
          type: 'template',
          value: source.slice(start, i),
          start,
          end: i,
          lineBreakBefore,
        });
        lineBreakBefore = false;
      }
      continue;
    }

    // Regex literal
    if (ch === '/' && canStartRegex(tokens[tokens.length - 1])) {
      const start = i;
      i += 1;
      let inCharClass = false;
      while (i < source.length) {
        const c = source[i];
        if (c === '\\') {
          i += 2;
          continue;
        }
        if (c === '[') inCharClass = true;
        else if (c === ']') inCharClass = false;
        else if (c === '/' && !inCharClass) {
          i += 1;
          while (i < source.length && isIdentPart(source[i])) i += 1;
          break;
        } else if (c === '\n' || c === '\r') {
          break;
        }
        i += 1;
      }
      tokens.push({
        type: 'regex',
        value: source.slice(start, i),
        start,
        end: i,
        lineBreakBefore,
      });
      lineBreakBefore = false;
      continue;
    }

    // Identifier / keyword
    if (isIdentStart(ch)) {
      const start = i;
      i += 1;
      while (i < source.length && isIdentPart(source[i])) i += 1;
      tokens.push({
        type: 'ident',
        value: source.slice(start, i),
        start,
        end: i,
        lineBreakBefore,
      });
      lineBreakBefore = false;
      continue;
    }

    // Number literal
    if (ch >= '0' && ch <= '9') {
      const start = i;
      i += 1;
      while (
        i < source.length
        && (isIdentPart(source[i]) || source[i] === '.')
      ) {
        i += 1;
      }
      tokens.push({
        type: 'number',
        value: source.slice(start, i),
        start,
        end: i,
        lineBreakBefore,
      });
      lineBreakBefore = false;
      continue;
    }

    // Punctuation
    if (templateBraceStack.length > 0) {
      if (ch === '{') {
        templateBraceStack[templateBraceStack.length - 1] += 1;
      } else if (ch === '}') {
        templateBraceStack[templateBraceStack.length - 1] -= 1;
      }
    }
    tokens.push({
      type: 'punct',
      value: ch,
      start: i,
      end: i + 1,
      lineBreakBefore,
    });
    lineBreakBefore = false;
    i += 1;
  }

  return tokens;
}

/**
 * Returns the end index of any leading JS directive prologue (e.g. `"use strict";`)
 * so inserted runtime blocks preserve strict mode.
 */
function findDirectivePrologueEnd(source) {
  const tokens = tokenizeJs(source);
  let idx = 0;
  let end = 0;
  while (idx < tokens.length && tokens[idx].type === 'string') {
    const next = tokens[idx + 1];
    if (next && next.type === 'punct' && next.value === ';') {
      end = next.end;
      idx += 2;
      continue;
    }
    if (!next || next.lineBreakBefore) {
      end = tokens[idx].end;
      idx += 1;
      continue;
    }
    break;
  }
  return end;
}

function isDirectivePrologueOnly(source) {
  const tokens = tokenizeJs(source);
  let idx = 0;
  while (idx < tokens.length) {
    if (tokens[idx].type !== 'string') return false;
    const next = tokens[idx + 1];
    if (next && next.type === 'punct' && next.value === ';') {
      idx += 2;
      continue;
    }
    if (!next || next.lineBreakBefore) {
      idx += 1;
      continue;
    }
    return false;
  }
  return true;
}

function hasUnmarkedLynxRuntimeDeclaration(source) {
  const tokens = tokenizeJs(source);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (
      t.type === 'ident'
      && (t.value === 'var' || t.value === 'let' || t.value === 'const'
        || t.value === 'function')
      && next.type === 'ident' && next.value === 'LynxRuntime'
    ) {
      return true;
    }
  }
  return false;
}

function findRawHostApi(tokens) {
  for (let i = 0; i < tokens.length; i += 1) {
    const prev = i > 0 ? tokens[i - 1] : null;
    const t = tokens[i];
    const isProperty = prev && prev.type === 'punct' && prev.value === '.';
    if (t.type !== 'ident' || isProperty) continue;

    if (t.value === '__FlushElementTree') {
      return '__FlushElementTree';
    }
    if (t.value === 'lynx') {
      let member = null;
      let afterMemberIdx = -1;
      if (
        tokens[i + 1]?.type === 'punct' && tokens[i + 1].value === '.'
        && tokens[i + 2]?.type === 'ident'
      ) {
        member = tokens[i + 2].value;
        afterMemberIdx = i + 3;
      } else if (
        tokens[i + 1]?.type === 'punct' && tokens[i + 1].value === '['
        && tokens[i + 2]?.type === 'string'
        && tokens[i + 3]?.type === 'punct' && tokens[i + 3].value === ']'
      ) {
        member = tokens[i + 2].value;
        afterMemberIdx = i + 4;
      }
      if (member !== null) {
        if (RAW_LYNX_MEMBERS.has(member)) {
          return `lynx.${member}`;
        }
        if (
          member === 'getJSModule'
          && tokens[afterMemberIdx]?.type === 'punct'
          && tokens[afterMemberIdx].value === '('
          && tokens[afterMemberIdx + 1]?.type === 'string'
          && tokens[afterMemberIdx + 1].value === 'GlobalEventEmitter'
        ) {
          return 'lynx.getJSModule(\'GlobalEventEmitter\')';
        }
      }
    }
  }
  return null;
}

function findTopLevelMtsHookCollision(tokens) {
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.type === 'punct') {
      if (t.value === '{') braceDepth += 1;
      else if (t.value === '}') braceDepth = Math.max(0, braceDepth - 1);
      else if (t.value === '(') parenDepth += 1;
      else if (t.value === ')') parenDepth = Math.max(0, parenDepth - 1);
      else if (t.value === '[') bracketDepth += 1;
      else if (t.value === ']') bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (braceDepth !== 0 || parenDepth !== 0 || bracketDepth !== 0) continue;
    if (t.type !== 'ident') continue;

    if (t.value === 'function' || t.value === 'class') {
      const prev = i > 0 ? tokens[i - 1] : null;
      const beforeDecl = prev?.type === 'ident' && prev.value === 'async'
        ? (i > 1 ? tokens[i - 2] : null)
        : prev;
      const isExpression = beforeDecl
        && (beforeDecl.type === 'punct'
          ? beforeDecl.value !== ';' && beforeDecl.value !== '}'
          : beforeDecl.type === 'ident'
            && REGEX_PRECEDING_KEYWORDS.has(beforeDecl.value));
      if (isExpression) continue;
      let nameIdx = i + 1;
      if (
        t.value === 'function'
        && tokens[nameIdx]?.type === 'punct' && tokens[nameIdx].value === '*'
      ) {
        nameIdx += 1;
      }
      const nameTok = tokens[nameIdx];
      if (
        nameTok?.type === 'ident' && MTS_RESERVED_GLOBALS.has(nameTok.value)
      ) {
        return `${t.value} ${nameTok.value}`;
      }
      continue;
    }

    if (t.value === 'var' || t.value === 'let' || t.value === 'const') {
      // Scan declarators in this top-level variable statement until `;` or
      // statement boundary while tracking nested initializers.
      let j = i + 1;
      let dBrace = 0;
      let dParen = 0;
      let dBracket = 0;
      let expectBinding = true;
      while (j < tokens.length) {
        const cur = tokens[j];
        if (dBrace === 0 && dParen === 0 && dBracket === 0) {
          if (cur.type === 'punct' && cur.value === ';') break;
          if (!expectBinding && cur.lineBreakBefore && cur.type === 'ident') {
            break;
          }
          if (expectBinding && cur.type === 'ident') {
            if (MTS_RESERVED_GLOBALS.has(cur.value)) {
              return `${t.value} ${cur.value}`;
            }
            expectBinding = false;
            j += 1;
            continue;
          }
          if (cur.type === 'punct' && cur.value === ',') {
            expectBinding = true;
            j += 1;
            continue;
          }
        }
        if (cur.type === 'punct') {
          if (cur.value === '{') dBrace += 1;
          else if (cur.value === '}') dBrace = Math.max(0, dBrace - 1);
          else if (cur.value === '(') dParen += 1;
          else if (cur.value === ')') dParen = Math.max(0, dParen - 1);
          else if (cur.value === '[') dBracket += 1;
          else if (cur.value === ']') dBracket = Math.max(0, dBracket - 1);
        }
        j += 1;
      }
    }
  }
  return null;
}

function formatBlock(entry, code) {
  return [
    `// BEGIN @lynx-js/lynx-runtime iife/${entry} (${version})`,
    code,
    `// END @lynx-js/lynx-runtime iife/${entry}`,
  ].join('\n');
}

function markerPattern(entry, global = false) {
  return new RegExp(
    `^[ \\t]*// BEGIN @lynx-js/lynx-runtime iife/${entry}(?: \\([^\\n]*\\))?\\r?\\n[\\s\\S]*?^[ \\t]*// END @lynx-js/lynx-runtime iife/${entry}[ \\t]*$`,
    global ? 'gm' : 'm',
  );
}

function loadIife(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing prebuilt IIFE artifact at ${filePath}. Run the package build first.`,
    );
  }
  const code = fs.readFileSync(filePath, 'utf8').trim();
  if (/<\/script/i.test(code)) {
    throw new Error(`Refusing to inline ${filePath}: contains </script.`);
  }
  return code;
}

function syncBody(body, attr, entry, code, filePath) {
  const block = formatBlock(entry, code);
  const matches = [...body.matchAll(markerPattern(entry, true))];
  if (matches.length > 1) {
    throw new Error(
      `${filePath} [${attr}]: found multiple marked iife/${entry} blocks; keep only one.`,
    );
  }
  if (matches.length === 1) {
    const match = matches[0];
    const prefix = body.slice(0, match.index);
    if (!isDirectivePrologueOnly(prefix)) {
      throw new Error(
        `${filePath} [${attr}]: executable code appears before the marked iife/${entry} block; move it after the block.`,
      );
    }
    return (
      body.slice(0, match.index)
      + block
      + body.slice(match.index + match[0].length)
    );
  }

  if (hasUnmarkedLynxRuntimeDeclaration(body)) {
    throw new Error(
      `${filePath} [${attr}]: found unmarked \`LynxRuntime\` declaration; remove it or wrap it with BEGIN/END markers before syncing so user code on the same line is not lost.`,
    );
  }

  const insertAt = findDirectivePrologueEnd(body);
  const before = body.slice(0, insertAt);
  const after = body.slice(insertAt);
  const needsLeadingNewline = !before.endsWith('\n');
  const needsTrailingNewline = after.length > 0 && !after.startsWith('\n')
    && !after.startsWith('\r\n');
  return (
    before
    + (needsLeadingNewline ? '\n' : '')
    + block
    + (needsTrailingNewline ? '\n' : '')
    + after
  );
}

function checkFile(filePath, artifacts) {
  const content = fs.readFileSync(filePath, 'utf8');
  let scripts;
  try {
    scripts = parseLynxScriptBlocks(content, filePath);
  } catch (err) {
    return [err instanceof Error ? err.message : String(err)];
  }

  const errors = [];
  for (const { attr, entry, body } of scripts) {
    const expected = formatBlock(entry, artifacts[entry]);
    const matches = [...body.matchAll(markerPattern(entry, true))];
    if (matches.length === 0) {
      errors.push(
        `${filePath} [${attr}]: missing marked @lynx-js/lynx-runtime iife/${entry} block (run sync-lynxml.mjs to insert).`,
      );
      continue;
    }
    if (matches.length > 1) {
      errors.push(
        `${filePath} [${attr}]: found multiple marked @lynx-js/lynx-runtime iife/${entry} blocks.`,
      );
      continue;
    }

    const match = matches[0];
    const prefix = body.slice(0, match.index);
    if (!isDirectivePrologueOnly(prefix)) {
      errors.push(
        `${filePath} [${attr}]: executable code appears before the @lynx-js/lynx-runtime iife/${entry} block.`,
      );
    }

    const actualNormalized = match[0].replace(/\r\n/g, '\n');
    if (actualNormalized !== expected) {
      errors.push(
        `${filePath} [${attr}]: inline iife/${entry} block does not match @lynx-js/lynx-runtime@${version}.`,
      );
    }

    const userCode = `${prefix}\n${body.slice(match.index + match[0].length)}`;
    const userTokens = tokenizeJs(userCode);
    const rawApi = findRawHostApi(userTokens);
    if (rawApi) {
      errors.push(
        `${filePath} [${attr}]: mixes raw host API \`${rawApi}\` with @lynx-js/lynx-runtime.`,
      );
    }
    if (attr === 'main') {
      const collision = findTopLevelMtsHookCollision(userTokens);
      if (collision) {
        errors.push(
          `${filePath} [main]: top-level \`${collision}\` collides with @lynx-js/lynx-runtime MTS global hooks; rename the handler.`,
        );
      }
    }
  }

  return errors;
}

function syncFile(filePath, artifacts) {
  const original = fs.readFileSync(filePath, 'utf8');
  const scripts = parseLynxScriptBlocks(original, filePath);

  // Compute all updates before writing, then splice from back to front so
  // offsets stay valid.
  const updates = scripts.map((script) => ({
    ...script,
    updatedBody: syncBody(
      script.body,
      script.attr,
      script.entry,
      artifacts[script.entry],
      filePath,
    ),
  }));

  let next = original;
  for (const update of [...updates].sort((a, b) => b.bodyStart - a.bodyStart)) {
    next = next.slice(0, update.bodyStart)
      + update.updatedBody
      + next.slice(update.bodyEnd);
  }

  const changed = next !== original;
  if (changed) {
    fs.writeFileSync(filePath, next, 'utf8');
  }
  return changed;
}

function main() {
  const args = process.argv.slice(2);
  let check = false;
  const files = [];

  for (const arg of args) {
    if (arg === '--check') {
      check = true;
    } else if (arg === '-h' || arg === '--help') {
      console.info(
        'Usage: node sync-lynxml.mjs [--check] <file.lynxml> [...files]',
      );
      return;
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      process.exitCode = 2;
      return;
    } else {
      files.push(arg);
    }
  }

  if (files.length === 0) {
    console.error(
      'Usage: node sync-lynxml.mjs [--check] <file.lynxml> [...files]',
    );
    process.exitCode = 2;
    return;
  }

  const artifacts = {
    mts: loadIife(THREAD_ENTRIES.main.iifePath),
    bts: loadIife(THREAD_ENTRIES.background.iifePath),
  };

  if (check) {
    const allErrors = [];
    for (const file of files) {
      const errs = checkFile(file, artifacts);
      if (errs.length === 0) {
        console.info(`OK ${file}`);
      } else {
        allErrors.push(...errs);
      }
    }
    if (allErrors.length > 0) {
      for (const err of allErrors) console.error(`ERROR ${err}`);
      process.exitCode = 1;
    }
    return;
  }

  for (const file of files) {
    const changed = syncFile(file, artifacts);
    console.info(`${changed ? 'UPDATED' : 'UNCHANGED'} ${file}`);
  }
}

main();
