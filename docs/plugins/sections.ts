// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, hasEntryPoint } from './workspace.ts';
import type { WorkspacePackage } from './workspace.ts';

/**
 * A part of the API reference that one TypeDoc run renders.
 */
export interface Section {
  /** The output directory under `content/<locale>`. */
  out: string;
  /** The typedoc-plugin-markdown router. */
  router: 'group' | 'member';
  /** The package directories, converted with TypeDoc's `packages` strategy. */
  packages: string[];
  /** The project name shown on the section index page. */
  name?: string;
  /** The Markdown file shown on the section index page. */
  readme?: string;
}

const REACT = join(ROOT, 'packages/react');
const GENUI = join(ROOT, 'packages/genui');

function genui(): Section {
  const config = JSON.parse(
    readFileSync(join(GENUI, 'typedoc.json'), 'utf8'),
  ) as { name: string; entryPoints: string[]; readme: string };
  return {
    out: 'api/genui',
    router: 'member',
    packages: config.entryPoints.map(entry => join(GENUI, entry)),
    name: config.name,
    readme: join(GENUI, config.readme),
  };
}

export function sections(packages: WorkspacePackage[]): Section[] {
  return [
    {
      out: 'api/react/testing-library',
      router: 'group',
      packages: [join(REACT, 'testing-library')],
      readme: join(REACT, 'testing-library/README.md'),
    },
    { out: 'api/react', router: 'group', packages: [REACT] },
    genui(),
    {
      out: 'api/packages',
      router: 'member',
      packages: packages
        .filter(pkg =>
          pkg.name !== '@lynx-js/react' && pkg.name !== '@lynx-js/genui'
          && hasEntryPoint(pkg.dir)
        )
        .map(pkg => pkg.dir),
    },
  ];
}
