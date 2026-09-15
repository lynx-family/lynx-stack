// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKAGES } from './packages.ts';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(
  readFileSync(join(DOCS, 'api-data/index.json'), 'utf8'),
) as Record<string, { package: string; description?: string }>;

for (const entry of PACKAGES) {
  if (entry.page) continue;
  const file = join(DOCS, 'content/en/api/packages', `${entry.id}.mdx`);
  if (existsSync(file)) continue;
  const meta = index[entry.id];
  const name = meta?.package ?? `@lynx-js/${entry.id}`;
  writeFileSync(
    file,
    `---
title: '${name}'
---

# ${name}

{/* @api PackageHeader package="${entry.id}" */}
{/* @api-end */}

${meta?.description ?? ''}

## Installation

import { PackageManagerTabs } from '@rspress/core/theme';

<PackageManagerTabs command="add ${name}" />

## API

{/* @api ApiExports package="${entry.id}" */}
{/* @api-end */}
`,
  );
  console.info(`created ${file}`);
}
