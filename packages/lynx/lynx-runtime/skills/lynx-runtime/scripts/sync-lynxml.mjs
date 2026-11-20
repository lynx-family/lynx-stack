#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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

const MTS_RESERVED_GLOBALS = [
  'renderPage',
  'updatePage',
  'updateGlobalProps',
  'processData',
  'getPageData',
  'removeComponents',
];

// Union of Native (`app-service.js`) and Web (`createChunkLoading`) BTS wrapper
// parameters so BTS scripts are compiled in their real host function-body scope.
const BTS_WRAPPER_PARAMS = [
  'require',
  'postMessage',
  'module',
  'exports',
  'lynxCoreInject',
  'Card',
  'setTimeout',
  'setInterval',
  'clearInterval',
  'clearTimeout',
  'NativeModules',
  'tt',
  'console',
  'Component',
  'TaroLynx',
  'ReactLynx',
  'nativeAppId',
  'Behavior',
  'LynxJSBI',
  'lynx',
  'window',
  'document',
  'frames',
  'self',
  'location',
  'navigator',
  'localStorage',
  'history',
  'Caches',
  'screen',
  'alert',
  'confirm',
  'prompt',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'webkit',
  'Reporter',
  'print',
  'global',
  'requestAnimationFrame',
  'cancelAnimationFrame',
];

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

/**
 * Matches a single attribute using the union of Web (quoted) and Native
 * (quoted or unquoted) LynxML attribute rules.
 */
function isSingleAttribute(attributes, attributeName, expectedValue) {
  if (!attributes.startsWith(attributeName)) return false;
  let rest = trimASCIIWhitespace(attributes.slice(attributeName.length));
  if (rest.length === 0 || rest[0] !== '=') return false;
  rest = trimASCIIWhitespace(rest.slice(1));
  if (rest.length === 0) return false;

  let value;
  const quote = rest[0];
  if (quote === '"' || quote === '\'') {
    const closingQuote = rest.indexOf(quote, 1);
    if (closingQuote !== rest.length - 1 || closingQuote <= 1) return false;
    value = rest.slice(1, closingQuote);
  } else {
    if (/[\t\n\f\r "'`=<>]/.test(rest)) return false;
    value = rest;
  }
  return expectedValue === undefined || value === expectedValue;
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
 * Matches `</name>` with optional ASCII whitespace before `>`, matching both
 * Web (`</script>`) and Native (`</script >`) LynxML closing tag rules.
 */
function endTagLengthAt(source, position, tagName) {
  if (!source.startsWith('</', position)) return 0;
  let cursor = position + 2;
  if (!source.startsWith(tagName, cursor)) return 0;
  cursor += tagName.length;
  if (
    cursor >= source.length
    || (!isASCIIWhitespace(source[cursor]) && source[cursor] !== '>')
  ) {
    return 0;
  }
  while (cursor < source.length && isASCIIWhitespace(source[cursor])) {
    cursor += 1;
  }
  if (cursor >= source.length || source[cursor] !== '>') return 0;
  return cursor + 1 - position;
}

function findEndTag(source, from, tagName) {
  let search = from;
  while (search < source.length) {
    const candidate = source.indexOf('<', search);
    if (candidate === -1) return null;
    const length = endTagLengthAt(source, candidate, tagName);
    if (length > 0) return { index: candidate, length };
    search = candidate + 1;
  }
  return null;
}

/**
 * Top-level LynxML scanner matching root, comment, `<style>`, and
 * `<script thread="main|background">` sections across both Native and Web
 * parsers so XML comments and whitespace/quoting variants cannot cause missed
 * or misdirected updates.
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
  if (
    rootAttrs.length > 0 && !isSingleAttribute(rootAttrs, 'engine-version')
  ) {
    fail(
      pos,
      '\'<lynx>\' only accepts a single non-empty \'engine-version\' attribute',
    );
  }
  pos = rootTagEnd + 1;

  let seenStyle = false;
  const seenScripts = new Map();
  let rootClosed = false;

  for (;;) {
    consumeIgnorable();
    const lynxCloseLen = endTagLengthAt(source, pos, 'lynx');
    if (lynxCloseLen > 0) {
      pos += lynxCloseLen;
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
      const endTag = findEndTag(source, contentStart, 'style');
      if (!endTag) fail(contentStart, 'missing closing tag \'</style>\'');
      if (
        trimASCIIWhitespace(source.slice(contentStart, endTag.index))
          .startsWith('<![CDATA[')
      ) {
        fail(contentStart, 'CDATA sections are not supported');
      }
      seenStyle = true;
      pos = endTag.index + endTag.length;
      continue;
    }

    if (tagName === 'script') {
      let thread = null;
      if (isSingleAttribute(attrs, 'thread', 'main')) {
        thread = 'main';
      } else if (isSingleAttribute(attrs, 'thread', 'background')) {
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
      const endTag = findEndTag(source, contentStart, 'script');
      if (!endTag) fail(contentStart, 'missing closing tag \'</script>\'');
      const body = source.slice(contentStart, endTag.index);
      if (trimASCIIWhitespace(body).startsWith('<![CDATA[')) {
        fail(contentStart, 'CDATA sections are not supported');
      }
      seenScripts.set(thread, {
        ...THREAD_ENTRIES[thread],
        bodyStart: contentStart,
        bodyEnd: endTag.index,
        body,
      });
      pos = endTag.index + endTag.length;
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

/**
 * Pure compile-only check in the thread's real V8 compilation scope:
 * classic script for MTS, `vm.compileFunction` body for BTS (no string wrapping
 * and no execution of page source).
 */
function parsesForThread(code, attr) {
  try {
    if (attr === 'background') {
      vm.compileFunction(code, BTS_WRAPPER_PARAMS);
    } else {
      new vm.Script(code);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Compile-only strict-mode probe: `with ({}) {}` is a compile-time SyntaxError
 * in strict mode and valid syntax in sloppy mode.
 */
function isStrictScript(code, attr) {
  return parsesForThread(code, attr)
    && !parsesForThread(`${code}\n;with ({}) {}`, attr);
}

/**
 * Consumes leading whitespace and complete `//` or `/* ... *\/` comments from
 * `start`. Returns -1 if an unclosed block comment is encountered.
 */
function skipLeadingCommentsAndWhitespace(source, start) {
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      i += 2;
      while (
        i < source.length
        && source[i] !== '\n'
        && source[i] !== '\r'
        && source[i] !== '\u2028'
        && source[i] !== '\u2029'
      ) {
        i += 1;
      }
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    break;
  }
  return i;
}

/**
 * Scans a leading JS string literal at `start` (without advancing into
 * non-string tokens). Returns end index after the closing quote, or -1.
 */
function scanStringLiteralEnd(source, start) {
  const quote = source[start];
  if (quote !== '\'' && quote !== '"') return -1;
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += source[i + 1] === '\r' && source[i + 2] === '\n' ? 3 : 2;
      continue;
    }
    if (ch === '\n' || ch === '\r' || ch === '\u2028' || ch === '\u2029') {
      return -1;
    }
    if (ch === quote) return i + 1;
    i += 1;
  }
  return -1;
}

/**
 * Verifies `prefix` (the slice before a managed block) contains only
 * whitespace, complete comments, and standalone directive string literals
 * (never executable code or an unclosed `/*` comment that swallows the block).
 */
function isValidLeadingPrologue(prefix) {
  let pos = 0;
  for (;;) {
    pos = skipLeadingCommentsAndWhitespace(prefix, pos);
    if (pos === -1) return false;
    if (pos === prefix.length) return true;

    const strEnd = scanStringLiteralEnd(prefix, pos);
    if (strEnd === -1) return false;
    const afterStr = skipLeadingCommentsAndWhitespace(prefix, strEnd);
    if (afterStr === -1) return false;
    if (afterStr < prefix.length && prefix[afterStr] === ';') {
      pos = afterStr + 1;
      continue;
    }
    if (
      afterStr === prefix.length
      || /[\r\n\u2028\u2029]/.test(prefix.slice(strEnd, afterStr))
    ) {
      pos = afterStr;
      continue;
    }
    return false;
  }
}

/**
 * Finds the exact end of an active strict-mode directive prologue using V8's
 * compiler so non-strict expressions like `"hello"\n.toUpperCase()` or
 * `"use strict"\n+ "foo"` are never split.
 */
function findInsertionOffset(body, attr) {
  if (!isStrictScript(body, attr)) return 0;

  let pos = 0;
  for (;;) {
    pos = skipLeadingCommentsAndWhitespace(body, pos);
    if (pos === -1 || pos >= body.length) return 0;

    const strEnd = scanStringLiteralEnd(body, pos);
    if (strEnd === -1) return 0;
    let candidateEnd = strEnd;
    const afterStr = skipLeadingCommentsAndWhitespace(body, strEnd);
    if (afterStr !== -1 && afterStr < body.length && body[afterStr] === ';') {
      candidateEnd = afterStr + 1;
    }
    if (isStrictScript(body.slice(0, candidateEnd), attr)) {
      return candidateEnd;
    }
    pos = candidateEnd;
  }
}

function formatBlock(entry, code) {
  return [
    `// BEGIN @lynx-js/lynx-runtime iife/${entry} (${version})`,
    code,
    `// END @lynx-js/lynx-runtime iife/${entry}`,
  ].join('\n');
}

function findManagedBlock(body, attr, entry, filePath) {
  const anyMarkerRe =
    /^[ \t]*\/\/ (BEGIN|END) @lynx-js\/lynx-runtime iife\/(mts|bts)/gm;
  let totalBegins = 0;
  let totalEnds = 0;
  for (const m of body.matchAll(anyMarkerRe)) {
    if (m[2] !== entry) {
      throw new Error(
        `${filePath} [${attr}]: found iife/${
          m[2]
        } marker inside [${attr}] script (expected iife/${entry}).`,
      );
    }
    if (m[1] === 'BEGIN') totalBegins += 1;
    else totalEnds += 1;
  }

  const beginRe = new RegExp(
    `^[ \\t]*// BEGIN @lynx-js/lynx-runtime iife/${entry}(?: \\([^\\n]*\\))?[ \\t]*$`,
    'gm',
  );
  const endRe = new RegExp(
    `^[ \\t]*// END @lynx-js/lynx-runtime iife/${entry}[ \\t]*$`,
    'gm',
  );
  const begins = [...body.matchAll(beginRe)];
  const ends = [...body.matchAll(endRe)];

  if (totalBegins !== begins.length || totalEnds !== ends.length) {
    throw new Error(
      `${filePath} [${attr}]: malformed inline iife/${entry} marker; every BEGIN/END marker must appear on its own standalone line without trailing text.`,
    );
  }

  if (begins.length === 0 && ends.length === 0) {
    return null;
  }

  if (
    begins.length !== 1 || ends.length !== 1
    || ends[0].index < begins[0].index
  ) {
    throw new Error(
      `${filePath} [${attr}]: expected exactly one paired BEGIN/END marker for iife/${entry} (found ${begins.length} BEGIN, ${ends.length} END).`,
    );
  }

  const start = begins[0].index;
  const end = ends[0].index + ends[0][0].length;
  const inner = body.slice(start + begins[0][0].length, ends[0].index);
  if (/\/\/ (?:BEGIN|END) @lynx-js\/lynx-runtime/.test(inner)) {
    throw new Error(
      `${filePath} [${attr}]: found an extra BEGIN/END marker inside the managed iife/${entry} block; refusing to overwrite ambiguous range.`,
    );
  }
  const prefix = body.slice(0, start);
  const suffix = body.slice(end);

  if (!isValidLeadingPrologue(prefix)) {
    throw new Error(
      `${filePath} [${attr}]: executable code or an unclosed comment appears before the managed iife/${entry} block.`,
    );
  }

  return {
    start,
    end,
    text: body.slice(start, end),
    prefix,
    suffix,
  };
}

/**
 * Uses V8's pure compile-only parser (`vm.Script` / `vm.compileFunction`) in
 * the thread's actual compilation scope to detect script/wrapper-level
 * `LynxRuntime` conflicts and MTS `globalThis` `var`/`function` hook collisions
 * without evaluating page source.
 */
function checkScriptBindings(userCode, attr, filePath, { checkMtsHooks }) {
  const errors = [];
  if (!parsesForThread(userCode, attr)) {
    errors.push(
      `${filePath} [${attr}]: user script is not valid JavaScript for [${attr}].`,
    );
    return errors;
  }

  if (!parsesForThread(`${userCode}\n;let LynxRuntime;`, attr)) {
    errors.push(
      `${filePath} [${attr}]: user code declares script-level \`LynxRuntime\` (for example an unmarked runtime copy or top-level declaration), which conflicts with the managed block.`,
    );
  }

  if (checkMtsHooks && attr === 'main') {
    for (const name of MTS_RESERVED_GLOBALS) {
      const collidesWithLet = !parsesForThread(
        `${userCode}\n;let ${name};`,
        attr,
      );
      const collidesWithVar = !parsesForThread(
        `${userCode}\n;var ${name};`,
        attr,
      );
      if (collidesWithLet && !collidesWithVar) {
        errors.push(
          `${filePath} [main]: \`${name}\` binds \`globalThis.${name}\` and will be overwritten by @lynx-js/lynx-runtime MTS activation; rename the handler.`,
        );
      }
    }
  }

  return errors;
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
  const managed = findManagedBlock(body, attr, entry, filePath);

  if (managed) {
    const userCode = `${managed.prefix}\n${managed.suffix}`;
    const bindingErrors = checkScriptBindings(userCode, attr, filePath, {
      checkMtsHooks: false,
    });
    if (bindingErrors.length > 0) {
      throw new Error(bindingErrors.join('\n'));
    }
    const nextBody = managed.prefix + block + managed.suffix;
    if (
      !parsesForThread(nextBody, attr)
      || isStrictScript(nextBody, attr) !== isStrictScript(userCode, attr)
    ) {
      throw new Error(
        `${filePath} [${attr}]: managed iife/${entry} block breaks script syntax or disables a "use strict" directive placed after the block; move "use strict" before the block.`,
      );
    }
    return nextBody;
  }

  const bindingErrors = checkScriptBindings(body, attr, filePath, {
    checkMtsHooks: false,
  });
  if (bindingErrors.length > 0) {
    throw new Error(bindingErrors.join('\n'));
  }

  const wasStrict = isStrictScript(body, attr);
  const insertAt = findInsertionOffset(body, attr);
  const before = body.slice(0, insertAt);
  const after = body.slice(insertAt);
  const needsLeadingNewline = !before.endsWith('\n');
  const needsTrailingNewline = after.length > 0 && !after.startsWith('\n')
    && !after.startsWith('\r\n');
  const nextBody = before
    + (needsLeadingNewline ? '\n' : '')
    + block
    + (needsTrailingNewline ? '\n' : '')
    + after;

  if (
    !parsesForThread(nextBody, attr)
    || isStrictScript(nextBody, attr) !== wasStrict
  ) {
    throw new Error(
      `${filePath} [${attr}]: refusing to write because inserting iife/${entry} would alter script syntax or strict mode.`,
    );
  }
  return nextBody;
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
    let managed;
    try {
      managed = findManagedBlock(body, attr, entry, filePath);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      continue;
    }

    if (!managed) {
      errors.push(
        `${filePath} [${attr}]: missing marked @lynx-js/lynx-runtime iife/${entry} block (run sync-lynxml.mjs to insert).`,
      );
      continue;
    }

    const expected = formatBlock(entry, artifacts[entry]);
    const actualNormalized = managed.text.replace(/\r\n/g, '\n');
    if (actualNormalized !== expected) {
      errors.push(
        `${filePath} [${attr}]: inline iife/${entry} block does not match @lynx-js/lynx-runtime@${version}.`,
      );
    }

    const userCode = `${managed.prefix}\n${managed.suffix}`;
    const bindingErrors = checkScriptBindings(userCode, attr, filePath, {
      checkMtsHooks: true,
    });
    errors.push(...bindingErrors);
    if (!parsesForThread(body, attr)) {
      errors.push(
        `${filePath} [${attr}]: script is not valid JavaScript for [${attr}].`,
      );
    } else if (
      bindingErrors.length === 0
      && isStrictScript(body, attr) !== isStrictScript(userCode, attr)
    ) {
      errors.push(
        `${filePath} [${attr}]: managed iife/${entry} block disables a "use strict" directive placed after the block; move "use strict" before the block.`,
      );
    }
  }

  return errors;
}

function syncFile(filePath, artifacts) {
  const original = fs.readFileSync(filePath, 'utf8');
  const scripts = parseLynxScriptBlocks(original, filePath);

  // Compute all updates before writing, then splice from back to front so
  // offsets stay valid and failed validations leave the file untouched.
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
