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
    if (!fs.existsSync(mainNodeIndexPath)) {
      throw new Error(`Node index asset should exist: ${mainNodeIndexPath}`);
    }

    const mainNodeIndex = JSON.parse(
      fs.readFileSync(mainNodeIndexPath, 'utf8'),
    );
    if (mainNodeIndex.version !== 1) {
      throw new Error('Main node index asset should expose version 1');
    }
    if (
      !Array.isArray(mainNodeIndex.sources)
      || !Array.isArray(mainNodeIndex.mappings)
      || mainNodeIndex.mappings.length === 0
    ) {
      throw new Error('Main node index asset should contain records');
    }
    if (
      !mainNodeIndex.sources.includes('index.jsx')
    ) {
      throw new Error('Main node index asset should include index.jsx records');
    }
    if (
      !mainNodeIndex.mappings.some(mapping =>
        Array.isArray(mapping)
        && mapping.length === 4
        && mainNodeIndex.sources[mapping[1]] === 'index.jsx'
      )
    ) {
      throw new Error('Main node index mappings should point to index.jsx');
    }

    const asyncRoot = path.join(compiler.outputPath, '.rspeedy/async');
    const asyncEntries = fs.readdirSync(asyncRoot, { recursive: true });
    const asyncNodeIndexFile = asyncEntries.find(entry =>
      entry.endsWith('node-index-map.json')
    );
    if (!asyncNodeIndexFile) {
      throw new Error('Async node index asset should exist');
    }

    const asyncNodeIndex = JSON.parse(
      fs.readFileSync(path.join(asyncRoot, asyncNodeIndexFile), 'utf8'),
    );
    if (asyncNodeIndex.version !== 1) {
      throw new Error('Async node index asset should expose version 1');
    }
    if (
      !Array.isArray(asyncNodeIndex.sources)
      || !Array.isArray(asyncNodeIndex.mappings)
      || asyncNodeIndex.mappings.length === 0
    ) {
      throw new Error('Async node index asset should contain records');
    }
    if (
      !asyncNodeIndex.sources.includes('lazy.jsx')
    ) {
      throw new Error('Async node index asset should include lazy.jsx records');
    }
    if (
      !asyncNodeIndex.mappings.some(mapping =>
        Array.isArray(mapping)
        && mapping.length === 4
        && asyncNodeIndex.sources[mapping[1]] === 'lazy.jsx'
      )
    ) {
      throw new Error('Async node index mappings should point to lazy.jsx');
    }
  },
};
