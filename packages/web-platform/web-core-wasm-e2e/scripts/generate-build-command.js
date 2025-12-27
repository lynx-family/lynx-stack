// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawn } from 'node:child_process';
import { glob } from 'node:fs/promises';
import path from 'node:path';

const configFiles = await Array.fromAsync(glob(
  [
    path.join(import.meta.dirname, '..', 'tests', '*', '*.config.ts'),
    path.join(import.meta.dirname, '..', 'tests', '*', '*', '*.config.ts'),
  ],
));
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
          cwd: path.join(import.meta.dirname, '..'),
          shell: true,
          env: process.env,
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
