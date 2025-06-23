// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import type { LoaderContext } from 'webpack';

import { extractPathFromIdentifier, stringifyRequest } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URI = 'webpack://';

/**
 * The options of CSS extract loader.
 *
 * @public
 */
export interface LoaderOptions {
  /**
   * The same as {@link https://github.com/webpack-contrib/mini-css-extract-plugin/tree/master?tab=readme-ov-file#emit | mini-css-extract-plugin}.
   * Control whether emit the CSS to filesystem.
   *
   * - If `true`(default), emits a file (writes a file to the filesystem).
   *
   * - If `false`, the plugin will extract the CSS but will not emit the file.
   *
   * It is often useful to disable this option for server-side packages.
   *
   * @defaultValue true
   * @public
   */
  emit?: boolean;

  /**
   * {@inheritdoc @lynx-js/rspeedy#CssExtractRspackLoaderOptions.esModule}
   */
  esModule?: boolean | undefined;

  /**
   * The layer of the CSS execution.
   *
   * @remarks
   *
   * This should be combined with `experiments.layers`.
   */
  layer?: string | undefined;
}

/**
 * See {@link https://github.com/webpack-contrib/css-loader#import | css-loader}
 */
type Dependency = [
  id: string,
  content: string,
  media: string,
  sourceMap: string | Buffer | undefined,
  supports: string | undefined,
  layer: string | undefined,
];

/**
 * With css-loader options: `{esModule: true}`
 */
interface ESModuleExports {
  __esModule: true;
  default: CJSExports;
}

/**
 * With css-loader options: `{esModule: true, module: {namedExport: true}}`
 *
 * This is different with ESModuleExports that it may not have default and default does not have `locals`.
 */
type NamedExport = Record<string, string> & {
  __esModule: true;
  default?: Dependency[];
};

/**
 * With css-loader options: `{esModule: false}`
 */
type CJSExports = Dependency[] & {
  __esModule: undefined;
  /** exists when css-loader option `modules.namedExport` is false */
  locals?: Record<string, string>;
};

type Exports = ESModuleExports | CJSExports | NamedExport;

export interface Dep {
  identifier: string;
  context: string | null;
  content: Buffer;
  media: string;
  identifierIndex?: number;
  supports?: string | undefined;
  layer?: string | undefined;
  sourceMap?: Buffer | undefined;
}

export async function load(
  this: LoaderContext<LoaderOptions>,
  request: string,
  addDependencies: (deps: Dep[]) => void,
): Promise<string> {
  /** TODO: schema */
  const options = this.getOptions();
  const emit = options.emit ?? true;
  const esModule = options.esModule ?? true;

  const moduleExports = await new Promise<Exports>((resolve, reject) => {
    this.importModule(
      `${this.resourcePath}.webpack[javascript/auto]!=!!!${request}`,
      {
        baseUri: `${BASE_URI}/`,
        layer: options.layer!,
      },
      (err, exports) => {
        if (err) {
          return reject(err);
        }

        return resolve(exports as Exports);
      },
    );
  });

  let locals: Record<string, string> | undefined;

  if (isNamedExports(moduleExports)) {
    Object.keys(moduleExports).forEach((key) => {
      if (key !== 'default') {
        locals ??= {};
        locals[key] = moduleExports[key]!;
      }
    });
  } else {
    locals =
      (isCJSExports(moduleExports) ? moduleExports : moduleExports.default)
        ?.locals;
  }

  let dependencies: Dep[] | [null, Exports | undefined][];

  const exportContent = isCJSExports(moduleExports)
    ? moduleExports
    : moduleExports.default;

  const { cssId: rawCssId } = parseQuery<{ cssId?: string }>(
    this.resourceQuery,
  );
  const cssId = rawCssId ?? '';

  const identifierCountMap = new Map<string, number>();

  if (Array.isArray(exportContent)) {
    dependencies = exportContent.map(
      ([identifier, content, media, sourceMap, supports, layer]) => {
        const count = identifierCountMap.get(identifier) ?? 0;
        const rawResourcePath = extractPathFromIdentifier(identifier, true)!;

        const [resourcePath, resourceQuery] = rawResourcePath.split('?') as [
          string,
          string | undefined,
        ];
        const params = new URLSearchParams(
          resourceQuery ? `?${resourceQuery}` : '',
        );
        if (params.get('cssId') === null) {
          params.set('cssId', cssId);
        }

        const filePath = path.relative(
          this.rootContext,
          extractPathFromIdentifier(identifier)!,
        );

        identifierCountMap.set(identifier, count + 1);

        return {
          identifier: identifier.replace(
            rawResourcePath,
            `${resourcePath}?${params.toString()}`,
          ),
          context: this.rootContext,
          content: Buffer.from(
            cssId
              && (params.get('common') === null
                || params.get('common') === 'false')
              /**
               * Given the following source code:
               *
               * ```css foo.css?cssId=1001
               * @import 'bar.css'
               * .foo {
               *   color: red;
               * }
               * ```
               *
               * ```css bar.css
               * .bar {
               *   color: blue;
               * }
               * ```
               *
               * The output should be:
               *
               * ```css
               * @cssId "1001" "bar.css" {
               *   .bar {
               *     color: blue;
               *   }
               * }
               * @cssId "1001" "foo.css" {
               *   .foo {
               *     color: red;
               *   }
               * }
               * ```
               */
              ? `\
@cssId "${cssId}" "${filePath}" {
${content}
}
`
              : content,
          ),
          media,
          supports,
          layer,
          identifierIndex: count,
          sourceMap: sourceMap
            ? Buffer.from(JSON.stringify(sourceMap))
            : undefined,
        };
      },
    );

    addDependencies(dependencies);
  } else {
    dependencies = [[null, exportContent]];
  }

  const result = (function makeResult() {
    if (locals) {
      if (isNamedExports(moduleExports)) {
        const identifiers = Array.from(
          (function* generateIdentifiers() {
            let identifierId = 0;

            for (const key of Object.keys(locals)) {
              identifierId += 1;

              yield [`_${identifierId.toString(16)}`, key];
            }
          })(),
        );

        const localsString = identifiers
          .map(
            // TODO: support function locals
            ([id, key]) => `\nvar ${id} = ${JSON.stringify(locals![key!])};`,
          )
          .join('');
        const exportsString = `export { ${
          identifiers
            .map(([id, key]) => `${id} as ${JSON.stringify(key)}`)
            .join(', ')
        } }`;

        return `${localsString}\n${exportsString}\n`;
      }

      return `\n${esModule ? 'export default' : 'module.exports = '} ${
        JSON.stringify(locals)
      };`;
    } else if (esModule) {
      return '\nexport {};';
    }
    return '';
  })();

  let resultSource = `// extracted by ${MiniCssExtractPlugin.pluginName}`;

  // only attempt hot reloading if the css is actually used for something other than hash values
  resultSource += this.hot && emit
    ? hotLoader(result, {
      loaderContext: this,
      options,
      locals,
      cssId,
    })
    : result;

  return resultSource;
}

export async function pitch(
  this: LoaderContext<LoaderOptions>,
  request: string,
): Promise<string | undefined> {
  if (
    this._compiler?.options?.experiments?.css
    && this._module
    && (this._module.type === 'css'
      || this._module.type === 'css/auto'
      || this._module.type === 'css/global'
      || this._module.type === 'css/module')
  ) {
    this.emitWarning(
      new Error(
        'You can\'t use `experiments.css` (`experiments.futureDefaults` enable built-in CSS support by default) and `@lynx-js/css-extract-webpack-plugin` together, please set `experiments.css` to `false` or set `{ type: "javascript/auto" }` for rules with `@lynx-js/css-extract-webpack-plugin` in your webpack config (now `@lynx-js/css-extract-webpack-plugin` does nothing).',
      ),
    );

    return;
  }

  /** TODO: schema */
  const options = this.getOptions();
  const emit = options.emit ?? true;

  const addDependencies = (
    dependencies: Dep[] | [null, Exports | undefined][],
  ) => {
    const { webpack } = this._compiler!;
    if (!Array.isArray(dependencies) && dependencies !== null) {
      throw new Error(
        `Exported value was not extracted as an array: ${
          JSON.stringify(
            dependencies,
          )
        }`,
      );
    }

    const identifierCountMap = new Map<string, number>();

    for (const dependency of dependencies) {
      if (!('identifier' in dependency) || !emit) {
        continue;
      }

      const CssDependency = MiniCssExtractPlugin.getCssDependency(
        webpack,
      );

      const count = identifierCountMap.get(dependency.identifier) ?? 0;

      this._module!.addDependency(
        new CssDependency(
          dependency,
          dependency.context,
          count,
        ),
      );
      identifierCountMap.set(
        dependency.identifier,
        count + 1,
      );
    }
  };

  return await load.call(this, request, addDependencies);
}

export default function loader(
  this: LoaderContext<LoaderOptions>,
  content: string,
): string | undefined {
  if (
    this._compiler?.options?.experiments?.css
    && this._module
    && (this._module.type === 'css'
      || this._module.type === 'css/auto'
      || this._module.type === 'css/global'
      || this._module.type === 'css/module')
  ) {
    return content;
  }

  return;
}

function hotLoader(
  content: string,
  context: {
    loaderContext: LoaderContext<LoaderOptions>;
    options: LoaderOptions;
    locals: Record<string, string> | undefined;
    cssId: string;
  },
) {
  const localsJsonString = JSON.stringify(JSON.stringify(context.locals));

  return `${content}
  if (module.hot) {
    (function() {
      var localsJsonString = ${localsJsonString};
      // ${Date.now()}
      var cssReload = require(${
    stringifyRequest(
      context.loaderContext,
      path.resolve(__dirname, '../runtime/hotModuleReplacement.cjs'),
    )
  })(module.id, ${JSON.stringify(context.options)}, "${context.cssId ?? '0'}");
      // only invalidate when locals change
      if (
        module.hot.data &&
        module.hot.data.value &&
        module.hot.data.value !== localsJsonString
      ) {
        module.hot.invalidate();
      } else {
        module.hot.accept();
      }
      module.hot.dispose(function(data) {
        data.value = localsJsonString;
        cssReload();
      });
    })();
  }`;
}

function isCJSExports(exports: Exports): exports is CJSExports {
  return !exports.__esModule;
}

function isNamedExports(exports: Exports): exports is NamedExport {
  return !isCJSExports(exports)
    && (!exports.default || !('locals' in exports.default));
}

function parseQuery<T>(query: string): T {
  const params = new URLSearchParams(query);
  return Object.fromEntries(params) as T;
}
