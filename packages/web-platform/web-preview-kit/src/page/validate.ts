// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Checks the parameters of every request. Each validator returns the
 * parameters typed, or throws a {@link ProtocolException} with
 * `INVALID_PARAMS` or `INVALID_PATH`.
 */

import type {
  FileChange,
  FileContent,
  FileMap,
  MethodName,
  Methods,
  PreviewData,
  ProjectConfig,
} from '../protocol.js';
import { isValidProjectPath } from '../shared/paths.js';
import { ProtocolException } from './errors.js';

type Params<M extends MethodName> = Methods[M]['params'];

function invalid(message: string): never {
  throw new ProtocolException('INVALID_PARAMS', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && !(value instanceof Uint8Array);
}

function checkPath(path: unknown, what: string): string {
  if (typeof path !== 'string') {
    invalid(`${what} must be a string.`);
  }
  if (!isValidProjectPath(path)) {
    throw new ProtocolException(
      'INVALID_PATH',
      `${
        JSON.stringify(path)
      } is not a valid project path: it must be relative, use "/", and have no empty, "." or ".." segment.`,
    );
  }
  return path;
}

function checkContent(content: unknown, what: string): FileContent {
  if (typeof content === 'string' || content instanceof Uint8Array) {
    return content;
  }
  return invalid(`${what} must be a string or a Uint8Array.`);
}

function checkFiles(files: unknown): FileMap {
  if (!isRecord(files)) {
    invalid('files must be an object of path to content.');
  }
  const checked: FileMap = {};
  for (const [path, content] of Object.entries(files)) {
    checked[checkPath(path, 'A file path')] = checkContent(
      content,
      `The content of ${path}`,
    );
  }
  return checked;
}

function checkConfig(config: unknown): ProjectConfig {
  if (!isRecord(config)) {
    invalid('config must be an object.');
  }
  const { entries, mode, hmr } = config;
  if (!isRecord(entries) || Object.keys(entries).length === 0) {
    invalid('config.entries must map at least one card name to its entry.');
  }
  const checkedEntries: Record<string, string> = {};
  for (const [name, entry] of Object.entries(entries)) {
    if (name.length === 0) {
      invalid(`${JSON.stringify(name)} is not a valid card name.`);
    }
    checkedEntries[name] = checkPath(entry, `The entry of card ${name}`);
  }
  if (mode !== undefined && mode !== 'development' && mode !== 'production') {
    invalid('config.mode must be "development" or "production".');
  }
  if (hmr !== undefined && typeof hmr !== 'boolean') {
    invalid('config.hmr must be a boolean.');
  }
  return {
    entries: checkedEntries,
    ...(mode === undefined ? {} : { mode }),
    ...(hmr === undefined ? {} : { hmr }),
  };
}

function checkData(data: unknown, what: string): PreviewData {
  if (!isRecord(data)) {
    invalid(`${what} must be an object.`);
  }
  const result: PreviewData = {};
  if ('initData' in data && data['initData'] !== undefined) {
    result.initData = data['initData'];
  }
  if ('globalProps' in data && data['globalProps'] !== undefined) {
    result.globalProps = data['globalProps'];
  }
  return result;
}

function checkChange(change: unknown, index: number): FileChange {
  if (!isRecord(change)) {
    invalid(`changes[${index}] must be an object.`);
  }
  switch (change['type']) {
    case 'write':
      return {
        type: 'write',
        path: checkPath(change['path'], `changes[${index}].path`),
        content: checkContent(change['content'], `changes[${index}].content`),
      };
    case 'delete':
      return {
        type: 'delete',
        path: checkPath(change['path'], `changes[${index}].path`),
      };
    case 'rename':
      return {
        type: 'rename',
        from: checkPath(change['from'], `changes[${index}].from`),
        to: checkPath(change['to'], `changes[${index}].to`),
      };
    default:
      return invalid(
        `changes[${index}].type must be "write", "delete" or "rename".`,
      );
  }
}

function checkNone(params: unknown, method: string): undefined {
  if (params !== undefined && params !== null && !isRecord(params)) {
    invalid(`${method} takes no parameters.`);
  }
  return undefined;
}

function checkObject(params: unknown, method: string) {
  if (!isRecord(params)) {
    invalid(`The parameters of ${method} must be an object.`);
  }
  return params;
}

function checkString(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    invalid(`${what} must be a non-empty string.`);
  }
  return value;
}

/** The validators, by method. */
export const validators: {
  [M in MethodName]: (params: unknown) => Params<M>;
} = {
  'project.open'(params) {
    const { files, config, card, data } = checkObject(params, 'project.open');
    return {
      files: checkFiles(files),
      config: checkConfig(config),
      ...(card === undefined ? {} : { card: checkString(card, 'card') }),
      ...(data === undefined ? {} : { data: checkData(data, 'data') }),
    };
  },
  'project.configure'(params) {
    const { config } = checkObject(params, 'project.configure');
    return { config: checkConfig(config) };
  },
  'project.close': params => checkNone(params, 'project.close'),
  'fs.apply'(params) {
    const { changes } = checkObject(params, 'fs.apply');
    if (!Array.isArray(changes)) {
      invalid('changes must be an array.');
    }
    return { changes: changes.map(checkChange) };
  },
  'fs.read'(params) {
    const { path, encoding } = checkObject(params, 'fs.read');
    if (
      encoding !== undefined && encoding !== 'utf8' && encoding !== 'binary'
    ) {
      invalid('encoding must be "utf8" or "binary".');
    }
    return {
      path: checkPath(path, 'path'),
      ...(encoding === undefined ? {} : { encoding }),
    };
  },
  'fs.list': params => checkNone(params, 'fs.list'),
  'build.getAsset'(params) {
    const { name } = checkObject(params, 'build.getAsset');
    return { name: checkPath(name, 'name') };
  },
  'preview.select'(params) {
    const { card } = checkObject(params, 'preview.select');
    return { card: checkString(card, 'card') };
  },
  'preview.reload': params => checkNone(params, 'preview.reload'),
  'preview.setData': params => checkData(params, 'The parameters'),
};

/** Whether `method` is a method of the protocol. */
export function isMethodName(method: unknown): method is MethodName {
  return typeof method === 'string'
    && Object.prototype.hasOwnProperty.call(validators, method);
}
