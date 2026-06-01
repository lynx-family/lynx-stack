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
export { Button } from './Button/index.jsx';
export { Card } from './Card/index.jsx';
export { CheckBox } from './CheckBox/index.jsx';
export { ChoicePicker } from './ChoicePicker/index.jsx';
export { DateTimeInput } from './DateTimeInput/index.jsx';
export { LineChart } from './LineChart/index.jsx';
export { PieChart } from './PieChart/index.jsx';
export { Column } from './Column/index.jsx';
export { Divider } from './Divider/index.jsx';
export { Icon } from './Icon/index.jsx';
export { Image } from './Image/index.jsx';
export { List } from './List/index.jsx';
export { Loading } from './Loading/index.jsx';
export { Modal } from './Modal/index.jsx';
export { RadioGroup } from './RadioGroup/index.jsx';
export { Row } from './Row/index.jsx';
export { Slider } from './Slider/index.jsx';
export { Tabs } from './Tabs/index.jsx';
export { Text } from './Text/index.jsx';
export { TextField } from './TextField/index.jsx';
export { DEFAULT_CHART_COLORS, escapeXml, formatValue } from './utils/chart.js';
