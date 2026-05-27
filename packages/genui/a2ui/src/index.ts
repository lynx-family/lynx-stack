// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// React surface — `<A2UI>` is the all-in-one entry point. The hooks +
// `NodeRenderer` are the contract for custom catalog components.
export {
  A2UI,
  NodeRenderer,
  useAction,
  useChecks,
  useDataBinding,
  useResolvedProps,
} from './react/index.js';
export type { A2UIProps, ActionProps, CheckLike } from './react/index.js';

// Store — a pure raw-message buffer. The developer's IO module pushes
// protocol messages into it; `<A2UI>` subscribes and processes them.
// `MessageProcessor` is exposed for protocol-aware consumers who want to
// build their own renderer instead of using `<A2UI>`.
export { createMessageStore, MessageProcessor } from './store/index.js';
export type {
  A2UIClientEventMessage,
  ComponentInstance,
  GenericComponentProps,
  MessageStore,
  MessageStoreOptions,
  Resource,
  ResourceInfo,
  ServerToClientMessage,
  Surface,
  SurfaceId,
  UserActionPayload,
} from './store/index.js';
// Helpers for IO that returns free-form text instead of structured
// protocol messages.
export {
  createFallbackMessagesFromPlainText,
  createTextCardMessages,
  normalizePayloadToMessages,
  prepareMessagesForProcessing,
} from './store/index.js';
// Function registry primitives. Consumers building a custom renderer reach
// the impls through these; `<A2UI>` consumers usually just spread
// `basicFunctions` into `catalogs`.
export {
  executeFunctionCall,
  functionRegistry,
  FunctionRegistry,
  resolveDynamicValue,
} from './store/index.js';
export type {
  FunctionCallContext,
  FunctionEntry,
  FunctionImpl,
  ResolveFunctionOptions,
} from './store/index.js';

// Catalog — declarative composition.
export {
  defineCatalog,
  defineFunction,
  mergeCatalogs,
  resolveCatalog,
  serializeCatalog,
} from './catalog/index.js';
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
} from './catalog/index.js';

// Built-in components — re-exported individually so apps can pick exactly
// what they need:
//
//   import { Text, Button } from '@lynx-js/genui/a2ui';
//   <A2UI catalogs={[Text, Button]} ... />
//
// There is intentionally no all-in-one aggregate — see
// `packages/genui/a2ui/src/catalog/README.md`.
export {
  Button,
  Card,
  CheckBox,
  ChoicePicker,
  DateTimeInput,
  Column,
  Divider,
  Image,
  LineChart,
  PieChart,
  List,
  Modal,
  RadioGroup,
  Row,
  Slider,
  Tabs,
  Text,
  TextField,
  Icon,
} from './catalog/index.js';

// A2UI 0.9 basic-catalog functions — registered + announced when spread
// into `<A2UI catalogs={[..., ...basicFunctions]}>`. Impls come from
// `@a2ui/web_core` (the upstream basic-catalog package), so the wire
// contract stays aligned with the spec for free.
export { basicFunctions, registerBasicFunctions } from './functions/index.js';
