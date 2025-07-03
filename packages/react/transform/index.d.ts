import type {
  CssScopeVisitorConfig,
  JsxTransformerConfig,
  ShakeVisitorConfig,
  DefineDceVisitorConfig,
  DirectiveDceVisitorConfig,
  WorkletVisitorConfig,
  DynamicImportVisitorConfig,
  InjectVisitorConfig,
} from './swc-plugin-reactlynx/index.d.ts';

import type { CompatVisitorConfig } from './swc-plugin-reactlynx-compat/index.d.ts';

export interface TransformReactLynxOptions {
  /**
   * @internal
   * This is used internally to make sure the test output is consistent.
   */
  mode?: 'production' | 'development' | 'test';
  sourceFileName?: string;
  sourcemap: boolean | string;
  sourceMapColumns?: boolean;
  inlineSourcesContent?: boolean;
  /**
   * @public
   * This is swc syntax config in JSON format
   */
  syntaxConfig?: Record<string, any>;
  isModule?: boolean | 'unknown';
  cssScope: boolean | CssScopeVisitorConfig;
  snapshot?: boolean | JsxTransformerConfig;
  shake: boolean | ShakeVisitorConfig;
  compat: boolean | CompatVisitorConfig;
  defineDCE: boolean | DefineDceVisitorConfig;
  directiveDCE: boolean | DirectiveDceVisitorConfig;
  worklet: boolean | WorkletVisitorConfig;
  dynamicImport?: boolean | DynamicImportVisitorConfig;
  /** @internal */
  inject?: boolean | InjectVisitorConfig;
}
export interface TransformReactLynxOutput {
  code: string;
  map?: string;
  errors: string[];
  warnings: string[];
}

export function transformReactLynx(
  code: string,
  options?: TransformReactLynxOptions | undefined | null,
): Promise<TransformReactLynxOutput>;
