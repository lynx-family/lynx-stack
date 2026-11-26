// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Runs real Rsbuild watch compilations in Node for the substitute bundler
// worker of the hot-update tests (`tests/e2e/workers/dev-worker.js`). It
// answers the worker's commands on `POST /__dev__/command` and streams build
// events with the emitted assets on `GET /__dev__/events` (server-sent
// events), from the kit's origin.

import fs from 'node:fs/promises';
import path from 'node:path';

import { createRsbuild } from '@rsbuild/core';

import { projectConfig } from './fixture-config.mjs';

/** Reads a request body as JSON. */
async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function decodeContent(content) {
  return typeof content === 'string'
    ? content
    : Buffer.from(content.base64, 'base64');
}

/** Turns an Rspack stats error into a `Diagnostic`. */
function toDiagnostic(error, projectDir) {
  // Rspack keeps the terminal colors in the message.
  // eslint-disable-next-line no-control-regex
  const diagnostic = {
    message: error.message.replace(/\u001B\[[0-9;]*m/g, ''),
  };
  // The resource is the last request of the module identifier, before the
  // layer: `<type>|<loaders>!<resource>|<layer>`.
  const resource = error.moduleIdentifier?.split('!').pop()?.split('|')[0]
    ?.replace(/\?.*$/, '');
  if (resource && resource.startsWith(`${projectDir}/`)) {
    diagnostic.file = resource.slice(projectDir.length + 1);
  }
  const match = /^(\d+):(\d+)/.exec(error.loc ?? '');
  if (match) {
    diagnostic.line = Number(match[1]);
    diagnostic.column = Number(match[2]);
  }
  return diagnostic;
}

async function listProjectFiles(dir, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (!prefix && entry.name === 'node_modules') {
      continue;
    }
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(
        ...await listProjectFiles(path.join(dir, entry.name), `${name}/`),
      );
    } else {
      files.push(name);
    }
  }
  return files.sort();
}

/**
 * @param {object} options
 * @param {string} options.workDir where projects and outputs are written
 * @param {string} options.nodeModules the `node_modules` the projects use
 */
export function createDevService({ workDir, nodeModules }) {
  /** @type {Set<import('node:http').ServerResponse>} */
  const listeners = new Set();
  let current;
  let latestRevision = 0;
  /** Every Rsbuild config handed to `createRsbuild`, for the report. */
  const configs = [];

  function send(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const response of listeners) {
      response.write(data);
    }
  }

  async function closeCurrent() {
    const previous = current;
    current = undefined;
    if (previous) {
      await new Promise(resolve => previous.watching.close(resolve));
    }
  }

  async function start({ generation, revision, config, files }) {
    const previousDir = current?.projectDir;
    const previousFiles = files ?? (previousDir
      ? Object.fromEntries(
        await Promise.all(
          (await listProjectFiles(previousDir)).map(async name => [
            name,
            await fs.readFile(path.join(previousDir, name), 'utf8'),
          ]),
        ),
      )
      : {});
    await closeCurrent();
    const projectDir = path.join(workDir, `project-${generation}`);
    const distPath = path.join(workDir, `dist-${generation}`);
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.mkdir(projectDir, { recursive: true });
    await fs.symlink(nodeModules, path.join(projectDir, 'node_modules'), 'dir');
    for (const [name, content] of Object.entries(previousFiles)) {
      await fs.mkdir(path.dirname(path.join(projectDir, name)), {
        recursive: true,
      });
      await fs.writeFile(path.join(projectDir, name), decodeContent(content));
    }
    latestRevision = revision;
    const rsbuildConfig = projectConfig({
      root: projectDir,
      distPath,
      entries: config.entries,
      mode: config.mode,
      hmr: config.hmr,
      publicPath: config.publicPath,
    });
    configs.push(rsbuildConfig);
    const realProjectDir = await fs.realpath(projectDir);
    const rsbuild = await createRsbuild({ cwd: projectDir, rsbuildConfig });
    const compiler = await rsbuild.createCompiler();
    let emitted = [];
    let buildRevision = revision;
    compiler.hooks.watchRun.tap('web-preview-kit-test', () => {
      emitted = [];
      buildRevision = latestRevision;
      send({ type: 'build-start', generation, revision: buildRevision });
    });
    compiler.hooks.assetEmitted.tap('web-preview-kit-test', (name, info) => {
      emitted.push({
        name,
        base64: Buffer.from(info.content).toString('base64'),
      });
    });
    compiler.hooks.done.tap('web-preview-kit-test', (stats) => {
      const json = stats.toJson({
        all: false,
        hash: true,
        errors: true,
        warnings: true,
        assets: true,
        timings: true,
      });
      const errors = (json.errors ?? []).map(error =>
        toDiagnostic(error, realProjectDir)
      );
      const assets = (json.assets ?? []).map(({ name, size }) => ({
        name,
        size,
      }));
      const cards = errors.length > 0
        ? []
        : Object.entries(config.entries).map(([name, entry]) => ({
          name,
          entry,
          bundle: `${name}.web.bundle`,
        })).filter(card => assets.some(asset => asset.name === card.bundle));
      send({
        type: 'build-done',
        generation,
        revision: buildRevision,
        report: {
          hash: json.hash,
          durationMs: json.time ?? 0,
          errors,
          warnings: (json.warnings ?? []).map(error =>
            toDiagnostic(error, realProjectDir)
          ),
          cards,
          assets,
        },
        emitted,
      });
    });
    const watching = compiler.watch({ aggregateTimeout: 50 }, (error) => {
      if (error) {
        console.error(error);
      }
    });
    current = { generation, projectDir, watching };
  }

  async function apply({ revision, changes }) {
    const { projectDir } = current;
    latestRevision = revision;
    for (const change of changes) {
      if (change.type === 'write') {
        const file = path.join(projectDir, change.path);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, decodeContent(change.content));
      } else if (change.type === 'delete') {
        await fs.rm(path.join(projectDir, change.path), {
          recursive: true,
          force: true,
        });
      } else {
        await fs.rename(
          path.join(projectDir, change.from),
          path.join(projectDir, change.to),
        );
      }
    }
  }

  async function handle(command) {
    switch (command.type) {
      case 'start':
        await start(command);
        return null;
      case 'apply':
        await apply(command);
        return null;
      case 'read': {
        const content = await fs.readFile(
          path.join(current.projectDir, command.path),
        ).catch(() => undefined);
        return content ? { base64: content.toString('base64') } : null;
      }
      case 'list':
        return listProjectFiles(current.projectDir);
      case 'close':
        await closeCurrent();
        return null;
    }
    throw new Error(`unknown command ${command.type}`);
  }

  let queue = Promise.resolve();

  /** The route to add to the kit server. */
  async function route(request, response, url) {
    if (url.pathname === '/__dev__/events') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'Cross-Origin-Resource-Policy': 'same-origin',
      });
      response.write(': connected\n\n');
      listeners.add(response);
      request.on('close', () => listeners.delete(response));
      return true;
    }
    if (url.pathname === '/__dev__/command' && request.method === 'POST') {
      const command = await readJson(request);
      const result = queue.then(() => handle(command));
      queue = result.catch(() => undefined);
      let body;
      try {
        body = { result: await result };
      } catch (error) {
        body = { error: String(error?.stack ?? error) };
      }
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Cross-Origin-Resource-Policy': 'same-origin',
      }).end(JSON.stringify(body));
      return true;
    }
    return false;
  }

  return {
    route,
    configs,
    async close() {
      await closeCurrent();
      for (const response of listeners) {
        response.end();
      }
    },
  };
}
