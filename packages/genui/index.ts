// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export {
  A2UI,
  NodeRenderer,
  useAction,
  useChecks,
  useDataBinding,
  useResolvedProps,
} from '@lynx-js/genui/a2ui/react';
export type {
  A2UIProps,
  ActionProps,
  CheckLike,
} from '@lynx-js/genui/a2ui/react';
export {
  createFallbackMessagesFromPlainText,
  createMessageStore,
  createResource,
  createTextCardMessages,
  executeFunctionCall,
  FunctionRegistry,
  functionRegistry,
  isDataBinding,
  isFunctionCall,
  MessageProcessor,
  normalizePayloadToMessages,
  prepareMessagesForProcessing,
  resolveDynamicValue,
  resolveFunctionArguments,
  SignalStore,
} from '@lynx-js/genui/a2ui/store';
export type {
  A2UIClientEventMessage,
  A2UIEvent,
  ComponentInstance,
  FunctionCallContext,
  FunctionEntry,
  FunctionImpl,
  GenericComponentProps,
  MessageStore,
  MessageStoreOptions,
  RawResource,
  ResolveFunctionOptions,
  Resource,
  ResourceInfo,
  ResourceStatus,
  ServerToClientMessage,
  Surface,
  SurfaceId,
  UserActionPayload,
} from '@lynx-js/genui/a2ui/store';
export {
  basicFunctions,
  registerBasicFunctions,
} from '@lynx-js/genui/a2ui/functions';
export * from '@lynx-js/genui/openui';
export {
  A2UI_PROTOCOL_VERSION,
  BASIC_CATALOG_EXAMPLES,
  BASIC_CATALOG_ID,
  buildA2UISystemPrompt,
  buildA2UISystemPromptAsync,
  createA2UICatalogFromManifests,
  loadBasicCatalog,
  readA2UICatalogFromDirectory,
  renderCatalogReference,
} from '@lynx-js/genui/a2ui-prompt';
export type {
  A2UICatalog as A2UIPromptCatalog,
  A2UIComponentProp,
  A2UIComponentSpec,
  A2UIExample,
  A2UIFunctionSpec,
  BuildSystemPromptOptions,
  JsonSchema as A2UIPromptJsonSchema,
  ReadA2UICatalogDirectoryOptions,
} from '@lynx-js/genui/a2ui-prompt';
export {
  createA2UICatalog,
  extractCatalogComponents,
  extractCatalogComponentsFromTypeDocJson,
  extractCatalogComponentsFromTypeDocProject,
  extractCatalogFunctions,
  extractCatalogFunctionsFromTypeDocJson,
  extractCatalogFunctionsFromTypeDocProject,
  findCatalogSourceFiles,
  writeCatalogArtifacts,
  writeCatalogComponents,
  writeCatalogFunctionDefinitions,
  writeCatalogFunctions,
  writeComponentCatalogs,
} from '@lynx-js/genui/a2ui-catalog-extractor';
export type {
  A2UICatalog as ExtractedA2UICatalog,
  CatalogArtifacts,
  CatalogComponent as ExtractedCatalogComponent,
  CatalogFunction,
  ExtractCatalogFromTypeDocOptions,
  ExtractCatalogOptions,
  FunctionDefinition,
  JsonSchema as ExtractedJsonSchema,
  TypeDocComment,
  TypeDocCommentDisplayPart,
  TypeDocCommentTag,
  TypeDocProject,
  TypeDocReflection,
  TypeDocSignature,
  TypeDocSource,
  TypeDocType,
  WriteComponentCatalogOptions,
} from '@lynx-js/genui/a2ui-catalog-extractor';
