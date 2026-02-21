// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WasmEngine } from '@lynx-js/trace-processor';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

async function disposeEngine(engine) {
  // Node 22 doesn't support `using`; manually dispose resources if supported.
  if (typeof engine.dispose === 'function') {
    await engine.dispose();
  } else if (typeof engine.close === 'function') {
    await engine.close();
  } else if (typeof engine.free === 'function') {
    await engine.free();
  } else if (typeof engine[Symbol.asyncDispose] === 'function') {
    await engine[Symbol.asyncDispose]();
  } else if (typeof engine[Symbol.dispose] === 'function') {
    engine[Symbol.dispose]();
  }
}

async function main() {
  if (
    !(await fs
      .stat(distDir)
      .then((s) => s.isDirectory())
      .catch(() => false))
  ) {
    console.info('No dist directory found. Skipping leak detection.');
    return;
  }

  const files = await fs.readdir(distDir);
  const ptraceFiles = files.filter((file) => file.endsWith('.ptrace'));

  if (ptraceFiles.length === 0) {
    console.info('No .ptrace files found in dist directory.');
    return;
  }

  let hasLeak = false;

  for (const file of ptraceFiles) {
    console.info(`Analyzing ${file}...`);
    const filePath = path.join(distDir, file);
    const fileContent = await fs.readFile(filePath);

    const engine = new WasmEngine('detectLeak');
    try {
      await engine.parse(fileContent);
      await engine.notifyEof();

      const countQuery = `
        SELECT count(*) as count
        FROM slice s
        JOIN args a1 ON s.arg_set_id = a1.arg_set_id
        JOIN args a2 ON s.arg_set_id = a2.arg_set_id
        WHERE s.name = 'FiberElement::Constructor' AND a1.key = 'debug.id' AND a2.key = 'debug.tag'
      `;
      const countResult = await engine.query(countQuery);
      const countIt = countResult.iter({ count: 0 });
      if (countIt.valid()) {
        const count = countIt.get('count');
        if (count === 0) {
          console.error(
            `Error: No FiberElement::Constructor events found in ${file}.`,
          );
          hasLeak = true;
          continue;
        }
      }

      const query = `\
WITH
CtorIds AS (
  SELECT
    a1.int_value AS id,
    a2.string_value AS tag
  FROM
    slice s
  JOIN
    args a1 ON s.arg_set_id = a1.arg_set_id
  JOIN
    args a2 ON s.arg_set_id = a2.arg_set_id
  WHERE
    s.name = 'FiberElement::Constructor' AND a1.key = 'debug.id' AND a2.key = 'debug.tag'
),
DtorIds AS (
  SELECT
    a.int_value AS id
  FROM
    slice s
  JOIN
    args a ON s.arg_set_id = a.arg_set_id
  WHERE
    s.name = 'FiberElement::Destructor' AND a.key = 'debug.id'
)
SELECT
  ctor.id, ctor.tag
FROM
  CtorIds ctor
LEFT JOIN
  DtorIds dtor ON ctor.id = dtor.id
WHERE
  dtor.id IS NULL;
`;

      const result = await engine.query(query);

      if (result.numRows() > 0) {
        console.error(`Memory leak detected in ${file}!`);
        const columns = result.columns();

        for (const it = result.iter({}); it.valid(); it.next()) {
          const row = {};
          for (const name of columns) {
            row[name] = it.get(name);
          }
          console.error(`Leaked Element:`, row);
        }
        hasLeak = true;
      } else {
        console.info(`No leaks detected in ${file}.`);
      }
    } finally {
      await disposeEngine(engine);
    }
  }

  if (hasLeak) {
    process.exit(1); // eslint-disable-line n/no-process-exit
  }
}

await main().catch((err) => {
  console.error(err);
  process.exit(1); // eslint-disable-line n/no-process-exit
});
