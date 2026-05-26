// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { CatalogManifest } from './defineCatalog.js';

export {
  defineCatalog,
  defineFunction,
  mergeCatalogs,
  resolveCatalog,
  serializeCatalog,
} from './defineCatalog.js';
export type {
  Catalog,
  CatalogComponent,
  CatalogFunctionDefinition,
  CatalogFunctionEntry,
  CatalogInput,
  CatalogManifest,
  CatalogSchema,
  FunctionManifest,
  ResolvedCatalogEntry,
  SerializedCatalog,
} from './defineCatalog.js';

export const catalogManifests: Record<string, CatalogManifest> = {};

// Per-component re-exports so consumers can pick exactly what they need.
// Each is an independently tree-shakeable ESM re-export — pulling `Text`
// does not drag `Button` into the bundle.
export { Button } from './Button/index.js';
export { Card } from './Card/index.js';
export { CheckBox } from './CheckBox/index.js';
export { ChoicePicker } from './ChoicePicker/index.js';
export { DateTimeInput } from './DateTimeInput/index.js';
export { LineChart } from './LineChart/index.js';
export { PieChart } from './PieChart/index.js';
export { Column } from './Column/index.js';
export { Divider } from './Divider/index.js';
export { Icon } from './Icon/index.js';
export { Image } from './Image/index.js';
export { List } from './List/index.js';
export { Modal } from './Modal/index.js';
export { RadioGroup } from './RadioGroup/index.js';
export { Row } from './Row/index.js';
export { Slider } from './Slider/index.js';
export { Tabs } from './Tabs/index.js';
export { Text } from './Text/index.js';
export { TextField } from './TextField/index.js';
export { DEFAULT_CHART_COLORS, escapeXml, formatValue } from './utils/chart.js';
