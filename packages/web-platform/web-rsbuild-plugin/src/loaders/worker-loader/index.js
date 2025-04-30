import path from 'path';

import { getOptions } from 'loader-utils';
import { validate } from 'schema-utils';

import schema from './options.json' with { type: 'json' };
import supportWebpack5 from './supportWebpack5.js';
import {
  getDefaultFilename,
  getDefaultChunkFilename,
  getExternalsType,
} from './utils.js';

export default function loader() {}

export function pitch(request) {
  this.cacheable(false);

  const options = getOptions(this);

  validate(schema, options, {
    name: 'Worker Loader',
    baseDataPath: 'options',
  });

  const { webpack } = this._compiler;

  const {
    EntryPlugin: SingleEntryPlugin,
    ExternalsPlugin,
    node: { NodeTargetPlugin },
    webworker: { WebWorkerTemplatePlugin },
    web: { FetchCompileWasmPlugin, FetchCompileAsyncWasmPlugin },
  } = webpack;

  const workerContext = {};
  const compilerOptions = this._compiler.options || {};
  const filename = options.filename
    ? options.filename
    : getDefaultFilename(compilerOptions.output.filename);
  const chunkFilename = options.chunkFilename
    ? options.chunkFilename
    : getDefaultChunkFilename(compilerOptions.output.chunkFilename);
  const publicPath = options.publicPath
    ? options.publicPath
    : compilerOptions.output.publicPath;

  workerContext.options = {
    filename,
    chunkFilename,
    publicPath,
    globalObject: 'self',
  };

  workerContext.compiler = this._compilation.createChildCompiler(
    `worker-loader ${request}`,
    workerContext.options,
  );

  new WebWorkerTemplatePlugin().apply(workerContext.compiler);

  if (this.target !== 'webworker' && this.target !== 'web') {
    new NodeTargetPlugin().apply(workerContext.compiler);
  }

  if (FetchCompileWasmPlugin) {
    new FetchCompileWasmPlugin({
      mangleImports: compilerOptions.optimization.mangleWasmImports,
    }).apply(workerContext.compiler);
  }

  if (FetchCompileAsyncWasmPlugin) {
    new FetchCompileAsyncWasmPlugin().apply(workerContext.compiler);
  }

  if (compilerOptions.externals) {
    new ExternalsPlugin(
      getExternalsType(compilerOptions),
      compilerOptions.externals,
    ).apply(workerContext.compiler);
  }

  new SingleEntryPlugin(
    this.context,
    `!!${request}`,
    path.parse(this.resourcePath).name,
  ).apply(workerContext.compiler);

  workerContext.request = request;

  const cb = this.async();

  supportWebpack5(this, workerContext, options, cb);
}
