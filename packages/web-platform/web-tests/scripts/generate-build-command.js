// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configFiles = [
  ...await Array.fromAsync(glob(
    path.join(__dirname, '..', 'tests', '*', '*.config.ts'),
  )),
  ...await Array.fromAsync(glob(
    path.join(__dirname, '..', 'tests', '*', '*', '*.config.ts'),
  )),
];
const command = configFiles
  .map(
    (lynxConfigFilePath) => `npx rspeedy build --config=${lynxConfigFilePath}`,
  );

if (command.length) {
  const promises = [];
  for (let i = 0; i < command.length; i++) {
    promises.push(
      new Promise((resolve, reject) => {
        const child = spawn(command[i], [], {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..'),
          shell: true,
        });

        child.on('exit', (code) => {
          if (code !== 0) {
            console.error(`Command failed with exit code ${code}`);
            reject(code);
          } else {
            resolve();
          }
        });
      }),
    );
  }
  await Promise.all(promises);
}
