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

    const mainNodeIndexPath = path.join(
      compiler.outputPath,
      '.rspeedy/main/node-index-map.json',
    );
    if (fs.existsSync(mainNodeIndexPath)) {
      throw new Error(
        `Node index asset should be cleaned after encode: ${mainNodeIndexPath}`,
      );
    }

    const capturedMainNodeIndexPath = path.join(
      compiler.outputPath,
      '.rspeedy/main/captured-node-index-map.json',
    );
    if (!fs.existsSync(capturedMainNodeIndexPath)) {
      throw new Error(
        `Captured node index asset should exist: ${capturedMainNodeIndexPath}`,
      );
    }
    const mainNodeIndex = JSON.parse(
      fs.readFileSync(capturedMainNodeIndexPath, 'utf8'),
    );
    if (mainNodeIndex.version !== 1) {
      throw new Error('Main node index asset should expose version 1');
    }
    if (
      !Array.isArray(mainNodeIndex.sources)
      || !Array.isArray(mainNodeIndex.mappings)
      || !Array.isArray(mainNodeIndex.uiMaps)
      || mainNodeIndex.mappings.length === 0
      || mainNodeIndex.uiMaps.length === 0
      || mainNodeIndex.mappings.length !== mainNodeIndex.uiMaps.length
    ) {
      throw new Error('Main node index asset should contain records');
    }
    if (
      !mainNodeIndex.sources.includes('index.jsx')
    ) {
      throw new Error('Main node index asset should include index.jsx records');
    }
    if (
      !mainNodeIndex.uiMaps.some(uiMap => Number.isInteger(uiMap))
    ) {
      throw new Error('Main node index uiMaps should contain nodeIndex values');
    }
    if (
      !mainNodeIndex.mappings.some((mapping, index) =>
        Array.isArray(mapping)
        && mapping.length === 3
        && Number.isInteger(mainNodeIndex.uiMaps[index])
        && mainNodeIndex.sources[mapping[0]] === 'index.jsx'
      )
    ) {
      throw new Error('Main node index uiMaps should point to index.jsx');
    }
    if (
      !mainNodeIndex.mappings.some(mapping =>
        Array.isArray(mapping)
        && mapping.length === 3
        && mainNodeIndex.sources[mapping[0]] === 'index.jsx'
      )
    ) {
      throw new Error('Main node index mappings should point to index.jsx');
    }

    const asyncRoot = path.join(compiler.outputPath, '.rspeedy/async');
    const asyncEntries = fs.readdirSync(asyncRoot, { recursive: true });
    const asyncNodeIndexFile = asyncEntries.find(entry =>
      entry.endsWith('node-index-map.json')
    );
    if (asyncNodeIndexFile) {
      throw new Error('Async node index asset should be cleaned after encode');
    }

    const capturedAsyncNodeIndexFile = asyncEntries.find(entry =>
      entry.endsWith('captured-node-index-map.json')
    );
    if (!capturedAsyncNodeIndexFile) {
      throw new Error('Captured async node index asset should exist');
    }

    const asyncNodeIndex = JSON.parse(
      fs.readFileSync(path.join(asyncRoot, capturedAsyncNodeIndexFile), 'utf8'),
    );
    if (asyncNodeIndex.version !== 1) {
      throw new Error('Async node index asset should expose version 1');
    }
    if (
      !Array.isArray(asyncNodeIndex.sources)
      || !Array.isArray(asyncNodeIndex.mappings)
      || !Array.isArray(asyncNodeIndex.uiMaps)
      || asyncNodeIndex.mappings.length === 0
      || asyncNodeIndex.uiMaps.length === 0
      || asyncNodeIndex.mappings.length !== asyncNodeIndex.uiMaps.length
    ) {
      throw new Error('Async node index asset should contain records');
    }
    if (
      !asyncNodeIndex.sources.includes('lazy.jsx')
    ) {
      throw new Error('Async node index asset should include lazy.jsx records');
    }
    if (
      !asyncNodeIndex.uiMaps.some(uiMap => Number.isInteger(uiMap))
    ) {
      throw new Error(
        'Async node index uiMaps should contain nodeIndex values',
      );
    }
    if (
      !asyncNodeIndex.mappings.some((mapping, index) =>
        Array.isArray(mapping)
        && mapping.length === 3
        && Number.isInteger(asyncNodeIndex.uiMaps[index])
        && asyncNodeIndex.sources[mapping[0]] === 'lazy.jsx'
      )
    ) {
      throw new Error('Async node index uiMaps should point to lazy.jsx');
    }
    if (
      !asyncNodeIndex.mappings.some(mapping =>
        Array.isArray(mapping)
        && mapping.length === 3
        && asyncNodeIndex.sources[mapping[0]] === 'lazy.jsx'
      )
    ) {
      throw new Error('Async node index mappings should point to lazy.jsx');
    }
  },
};
