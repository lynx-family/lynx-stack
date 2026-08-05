// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Builds every `<Background>` matrix permutation, one build per permutation.
 *
 * Each case is built on its own rather than as one multi-entry compilation on
 * purpose: `enableMTSRendering` is a property of the *build*, so batching the
 * cases would let one case's detection decide another's mode, and every
 * "did detection see this shape?" answer would be a sibling's answer.
 *
 * Both targets are built, because neither alone can answer the question:
 *   - web  → `dist/` ......... what Lynx for Web can run, for the screenshots.
 *   - lynx → `dist-bundle/` .. where `main-thread.js` is its own asset, which
 *                              is the only place "did the deferred code leave
 *                              the main-thread chunk" is answerable.
 *
 * Usage: node tests/bgmatrix.build.mjs [--target=web|lynx|both] [--case=<name>]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MATRIX_DIR = path.join(__dirname, 'bgmatrix');
const REPORT_DIR = path.join(ROOT, 'bgmatrix-report');
const LOG_DIR = path.join(REPORT_DIR, 'build-logs');

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const target = arg('target', 'both');
const only = arg('case');

const CONFIGS = {
  web: 'tests/reactlynx/bgmatrix-one.config.ts',
  lynx: 'tests/reactlynx/bgmatrix-bundle.config.ts',
};

const VARIANTS = ['auto', 'off', 'on'];
const cases = Object.keys(
  JSON.parse(fs.readFileSync(path.join(MATRIX_DIR, 'cases.json'), 'utf8')),
).filter((name) => !only || name === only);

const targets = target === 'both' ? ['web', 'lynx'] : [target];

function build(name, variant, which) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn(
      'npx',
      ['rspeedy', 'build', `--config=${CONFIGS[which]}`],
      {
        cwd: ROOT,
        env: { ...process.env, BG_CASE: name, BG_VARIANT: variant },
      },
    );
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => chunks.push(c));
    child.on('close', (code) => {
      resolve({ code: code ?? 1, log: Buffer.concat(chunks).toString() });
    });
  });
}

/**
 * The one line of a failed build worth putting in the report — the diagnostic
 * a user would read, not rspack's "compilation failed" wrapper around it.
 */
function reason(log) {
  const specific = /^.*(?:ModuleError|ModuleBuildError|ModuleParseError):.*$/m
    .exec(log);
  const any = /^.*Error:.*$/m.exec(log);
  return (specific?.[0] ?? any?.[0])
    ?.replace(/^[\s×╰─▶·|]+/, '')
    .trim()
    .slice(0, 400);
}

fs.mkdirSync(LOG_DIR, { recursive: true });

const outcomes = {};
for (const which of targets) {
  for (const name of cases) {
    for (const variant of VARIANTS) {
      const { code, log } = await build(name, variant, which);
      fs.writeFileSync(
        path.join(LOG_DIR, `${which}-${name}--${variant}.log`),
        log,
      );
      outcomes[`${which}:${name}--${variant}`] = code === 0
        ? { ok: true }
        : { ok: false, reason: reason(log) };
      process.stdout.write(
        `${code === 0 ? '·' : '✗'} ${which} ${name} ${variant}\n`,
      );
    }
  }
}

const outFile = path.join(REPORT_DIR, 'builds.json');
const previous = fs.existsSync(outFile)
  ? JSON.parse(fs.readFileSync(outFile, 'utf8'))
  : {};
fs.writeFileSync(
  outFile,
  JSON.stringify({ ...previous, ...outcomes }, null, 2),
);

const failed = Object.entries(outcomes).filter(([, o]) => !o.ok);
console.log(
  `${Object.keys(outcomes).length} builds, ${failed.length} refused`,
);
for (const [key, { reason: why }] of failed) console.log(`  ${key}: ${why}`);
