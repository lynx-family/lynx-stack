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

const THREADS = [
  {
    attr: 'main',
    entry: 'mts',
    iifePath: path.join(pkgRoot, 'dist/iife/mts.js'),
  },
  {
    attr: 'background',
    entry: 'bts',
    iifePath: path.join(pkgRoot, 'dist/iife/bts.js'),
  },
];

const RAW_HOST_API_RE =
  /\b(?:lynx\.(?:getEngine|getJSContext|getCoreContext|__globalProps)|GlobalEventEmitter|__FlushElementTree)\b/;
const MTS_GLOBAL_HOOK_RE =
  /^\s*function\s+(?:renderPage|updatePage|updateGlobalProps|processData|getPageData|removeComponents)\s*\(/m;

function formatBlock(entry, code) {
  return [
    `// BEGIN @lynx-js/lynx-runtime iife/${entry} (${version})`,
    code,
    `// END @lynx-js/lynx-runtime iife/${entry}`,
  ].join('\n');
}

function markerPattern(entry) {
  return new RegExp(
    `^[ \\t]*// BEGIN @lynx-js/lynx-runtime iife/${entry}(?: \\([^\\n]*\\))?\\r?\\n[\\s\\S]*?^[ \\t]*// END @lynx-js/lynx-runtime iife/${entry}[ \\t]*$`,
    'm',
  );
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
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

function findScriptBlock(content, attr) {
  const re = new RegExp(
    `(<script\\s+thread="${attr}">)([\\s\\S]*?)(<\\/script>)`,
  );
  const match = re.exec(content);
  if (!match) return null;
  return {
    full: match[0],
    open: match[1],
    body: match[2],
    close: match[3],
    index: match.index,
  };
}

function syncBody(body, entry, code) {
  const block = formatBlock(entry, code);
  const markedRe = markerPattern(entry);
  if (markedRe.test(body)) {
    return body.replace(markedRe, () => block);
  }
  const unmarkedRe = /^[ \t]*var LynxRuntime;[^\r\n]*$/m;
  if (unmarkedRe.test(body)) {
    return body.replace(unmarkedRe, () => block);
  }
  const leading = body.startsWith('\n') || body.startsWith('\r\n') ? '' : '\n';
  return `\n${block}${leading}${body}`;
}

function checkFile(filePath, artifacts) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  let matchedThreads = 0;

  for (const { attr, entry } of THREADS) {
    const script = findScriptBlock(content, attr);
    if (!script) continue;
    matchedThreads += 1;

    const expected = formatBlock(entry, artifacts[entry]);
    const markedRe = markerPattern(entry);
    const markedMatch = markedRe.exec(script.body);
    if (!markedMatch) {
      errors.push(
        `${filePath} [${attr}]: missing marked @lynx-js/lynx-runtime iife/${entry} block (run sync-lynxml.mjs to insert).`,
      );
      continue;
    }
    const normalizedActual = markedMatch[0]
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .join('\n');
    if (normalizedActual !== expected) {
      errors.push(
        `${filePath} [${attr}]: inline iife/${entry} block does not match @lynx-js/lynx-runtime@${version} byte-for-byte.`,
      );
    }

    const userCode = stripComments(script.body.replace(markedRe, ''));
    const rawMatch = RAW_HOST_API_RE.exec(userCode);
    if (rawMatch) {
      errors.push(
        `${filePath} [${attr}]: mixes raw host API \`${
          rawMatch[0]
        }\` with @lynx-js/lynx-runtime.`,
      );
    }
    if (attr === 'main') {
      const hookMatch = MTS_GLOBAL_HOOK_RE.exec(userCode);
      if (hookMatch) {
        errors.push(
          `${filePath} [main]: top-level \`${
            hookMatch[0].trim()
          }\` collides with @lynx-js/lynx-runtime MTS global hooks; rename the handler.`,
        );
      }
    }
  }

  if (matchedThreads === 0) {
    errors.push(
      `${filePath}: no <script thread="main"> or <script thread="background"> blocks found.`,
    );
  }
  return errors;
}

function syncFile(filePath, artifacts) {
  const original = fs.readFileSync(filePath, 'utf8');
  let next = original;
  let matchedThreads = 0;

  for (const { attr, entry } of THREADS) {
    const script = findScriptBlock(next, attr);
    if (!script) continue;
    matchedThreads += 1;
    const updatedBody = syncBody(script.body, entry, artifacts[entry]);
    next = next.slice(0, script.index)
      + script.open
      + updatedBody
      + script.close
      + next.slice(script.index + script.full.length);
  }

  if (matchedThreads === 0) {
    throw new Error(
      `${filePath}: no <script thread="main"> or <script thread="background"> blocks found.`,
    );
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
    mts: loadIife(THREADS[0].iifePath),
    bts: loadIife(THREADS[1].iifePath),
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
