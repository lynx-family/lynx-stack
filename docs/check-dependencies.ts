// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { referenceSections } from './plugins/sections.ts';
import { LYNX_STACK } from './plugins/site.ts';
import { DOCS, publicPackages } from './plugins/workspace.ts';

const packages = publicPackages(LYNX_STACK.root);
const sections = referenceSections(LYNX_STACK, packages);
const required = new Set(
  sections.flatMap(section => section.packages).map(dir => {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      name: string;
    };
    return pkg.name;
  }),
);
// Section umbrellas also supply readmes and the private packages they aggregate.
for (const name of Object.keys(LYNX_STACK.ownSections)) required.add(name);
const pkg = JSON.parse(readFileSync(join(DOCS, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};
const missing = [...required].filter(name =>
  !pkg.devDependencies[name]?.startsWith('workspace:')
).sort();
if (missing.length > 0) {
  throw new Error(
    `Add workspace devDependencies to docs/package.json: ${missing.join(', ')}`,
  );
}
console.info(
  `Docs workspace dependencies cover all ${required.size} required packages.`,
);
