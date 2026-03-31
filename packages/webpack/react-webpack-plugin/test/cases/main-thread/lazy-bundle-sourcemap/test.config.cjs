const path = require('node:path');
const fs = require('node:fs');

/** @type {import("@lynx-js/test-tools").TConfigCaseConfig} */
module.exports = {
  bundlePath: [
    'main__main-thread.js',
    'main__background.js',
  ],
  check(_stats, compiler) {
    const mainThreadMap = path.join(
      compiler.outputPath,
      'main/main-thread.js.map',
    );
    if (!fs.existsSync(mainThreadMap)) {
      throw new Error(`Sourcemap file should exist: ${mainThreadMap}`);
    }
    const map = JSON.parse(fs.readFileSync(mainThreadMap, 'utf8'));
    if (!map.mappings || map.mappings.length < 10) {
      throw new Error('Sourcemap mappings should not be empty');
    }

    const mainUiSourceMapPath = path.join(
      compiler.outputPath,
      '.rspeedy/main/ui-source-map.json',
    );
    if (fs.existsSync(mainUiSourceMapPath)) {
      throw new Error(
        `UI source map asset should be cleaned after encode: ${mainUiSourceMapPath}`,
      );
    }

    const capturedMainUiSourceMapPath = path.join(
      compiler.outputPath,
      '.rspeedy/main/captured-ui-source-map.json',
    );
    if (!fs.existsSync(capturedMainUiSourceMapPath)) {
      throw new Error(
        `Captured UI source map asset should exist: ${capturedMainUiSourceMapPath}`,
      );
    }
    const mainUiSourceMap = JSON.parse(
      fs.readFileSync(capturedMainUiSourceMapPath, 'utf8'),
    );
    if (mainUiSourceMap.version !== 1) {
      throw new Error('Main UI source map asset should expose version 1');
    }
    if (
      !Array.isArray(mainUiSourceMap.sources)
      || !Array.isArray(mainUiSourceMap.mappings)
      || !Array.isArray(mainUiSourceMap.uiMaps)
      || mainUiSourceMap.mappings.length === 0
      || mainUiSourceMap.uiMaps.length === 0
      || mainUiSourceMap.mappings.length !== mainUiSourceMap.uiMaps.length
    ) {
      throw new Error('Main UI source map asset should contain records');
    }
    if (
      !mainUiSourceMap.sources.includes('index.jsx')
    ) {
      throw new Error(
        'Main UI source map asset should include index.jsx records',
      );
    }
    if (
      !mainUiSourceMap.uiMaps.some(uiMap => Number.isInteger(uiMap))
    ) {
      throw new Error(
        'Main UI source map uiMaps should contain uiSourceMap values',
      );
    }
    if (
      !mainUiSourceMap.mappings.some((mapping, index) =>
        Array.isArray(mapping)
        && mapping.length === 3
        && Number.isInteger(mainUiSourceMap.uiMaps[index])
        && mainUiSourceMap.sources[mapping[0]] === 'index.jsx'
      )
    ) {
      throw new Error('Main UI source map uiMaps should point to index.jsx');
    }
    if (
      !mainUiSourceMap.mappings.some(mapping =>
        Array.isArray(mapping)
        && mapping.length === 3
        && mainUiSourceMap.sources[mapping[0]] === 'index.jsx'
      )
    ) {
      throw new Error('Main UI source map mappings should point to index.jsx');
    }

    const asyncRoot = path.join(compiler.outputPath, '.rspeedy/async');
    const asyncEntries = fs.readdirSync(asyncRoot, { recursive: true });
    const asyncUiSourceMapFile = asyncEntries.find(entry =>
      entry.endsWith('ui-source-map.json')
    );
    if (asyncUiSourceMapFile) {
      throw new Error(
        'Async UI source map asset should be cleaned after encode',
      );
    }

    const capturedAsyncUiSourceMapFile = asyncEntries.find(entry =>
      entry.endsWith('captured-ui-source-map.json')
    );
    if (!capturedAsyncUiSourceMapFile) {
      throw new Error('Captured async UI source map asset should exist');
    }

    const asyncUiSourceMap = JSON.parse(
      fs.readFileSync(
        path.join(asyncRoot, capturedAsyncUiSourceMapFile),
        'utf8',
      ),
    );
    if (asyncUiSourceMap.version !== 1) {
      throw new Error('Async UI source map asset should expose version 1');
    }
    if (
      !Array.isArray(asyncUiSourceMap.sources)
      || !Array.isArray(asyncUiSourceMap.mappings)
      || !Array.isArray(asyncUiSourceMap.uiMaps)
      || asyncUiSourceMap.mappings.length === 0
      || asyncUiSourceMap.uiMaps.length === 0
      || asyncUiSourceMap.mappings.length !== asyncUiSourceMap.uiMaps.length
    ) {
      throw new Error('Async UI source map asset should contain records');
    }
    if (
      !asyncUiSourceMap.sources.includes('lazy.jsx')
    ) {
      throw new Error(
        'Async UI source map asset should include lazy.jsx records',
      );
    }
    if (
      !asyncUiSourceMap.uiMaps.some(uiMap => Number.isInteger(uiMap))
    ) {
      throw new Error(
        'Async UI source map uiMaps should contain uiSourceMap values',
      );
    }
    if (
      !asyncUiSourceMap.mappings.some((mapping, index) =>
        Array.isArray(mapping)
        && mapping.length === 3
        && Number.isInteger(asyncUiSourceMap.uiMaps[index])
        && asyncUiSourceMap.sources[mapping[0]] === 'lazy.jsx'
      )
    ) {
      throw new Error('Async UI source map uiMaps should point to lazy.jsx');
    }
    if (
      !asyncUiSourceMap.mappings.some(mapping =>
        Array.isArray(mapping)
        && mapping.length === 3
        && asyncUiSourceMap.sources[mapping[0]] === 'lazy.jsx'
      )
    ) {
      throw new Error('Async UI source map mappings should point to lazy.jsx');
    }
  },
};
