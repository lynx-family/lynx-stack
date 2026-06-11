// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function setup() {
  await fs.promises.copyFile(
    path.join(__dirname, '..', '..', 'lib', 'rspack-loader.js'),
    path.join(__dirname, '..', '..', 'src', 'rspack-loader.js'),
  );

  await fs.promises.copyFile(
    path.join(__dirname, '..', '..', 'lib', 'rspack-loader.js.map'),
    path.join(__dirname, '..', '..', 'src', 'rspack-loader.js.map'),
  );

  await fs.promises.copyFile(
    path.join(__dirname, '..', '..', 'lib', 'util.js'),
    path.join(__dirname, '..', '..', 'src', 'util.js'),
  );

  await fs.promises.copyFile(
    path.join(__dirname, '..', '..', 'lib', 'util.js.map'),
    path.join(__dirname, '..', '..', 'src', 'util.js.map'),
  );

  return async () => {
    await fs.promises.unlink(
      path.join(__dirname, '..', '..', 'src', 'rspack-loader.js'),
    );
    await fs.promises.unlink(
      path.join(__dirname, '..', '..', 'src', 'rspack-loader.js.map'),
    );

    await fs.promises.unlink(
      path.join(__dirname, '..', '..', 'src', 'util.js'),
    );
    await fs.promises.unlink(
      path.join(__dirname, '..', '..', 'src', 'util.js.map'),
    );
  };
}
