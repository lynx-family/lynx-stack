// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BenchCatalogLabel } from './a2ui-bench-types';
import { BASIC_CATALOG } from '../agent/a2ui-catalog';
import type { A2UICatalog, A2UIComponentSpec } from '../agent/a2ui-catalog';

const CORE_COMPONENTS = new Set([
  'Text',
  'Row',
  'Column',
  'Card',
  'Button',
  'Image',
  'List',
  'Divider',
]);

const MINIMAL_COMPONENTS = new Set([
  'Text',
  'Row',
  'Column',
  'Card',
  'Button',
]);

function filterCatalog(
  label: BenchCatalogLabel,
  names: ReadonlySet<string>,
): A2UICatalog {
  const components = BASIC_CATALOG.components.filter(
    (component): component is A2UIComponentSpec => names.has(component.name),
  );
  return {
    ...BASIC_CATALOG,
    id: `${BASIC_CATALOG.id}#bench-${label.toLowerCase().replaceAll(' ', '-')}`,
    label: `Lynx A2UI ${label} (bench)`,
    components,
    extraRules: [
      ...(BASIC_CATALOG.extraRules ?? []),
      `Bench catalog subset: ${label}. Use only these components: ${
        components.map((component) => component.name).join(', ')
      }.`,
    ],
    examples: BASIC_CATALOG.examples,
  };
}

export function resolveBenchCatalog(label: BenchCatalogLabel): A2UICatalog {
  if (label === 'Core Catalog') {
    return filterCatalog(label, CORE_COMPONENTS);
  }
  if (label === 'Minimal Catalog') {
    return filterCatalog(label, MINIMAL_COMPONENTS);
  }
  return BASIC_CATALOG;
}
