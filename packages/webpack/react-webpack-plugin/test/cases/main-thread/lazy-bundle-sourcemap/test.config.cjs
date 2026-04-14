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

    const mainDebugMetadataPath = path.join(
      compiler.outputPath,
      '.rspeedy/main/debug-metadata.json',
    );
    if (fs.existsSync(mainDebugMetadataPath)) {
      throw new Error(
        `Debug metadata asset should be cleaned after encode: ${mainDebugMetadataPath}`,
      );
    }

    const capturedMainDebugMetadataPath = path.join(
      compiler.outputPath,
      '.rspeedy/main/captured-debug-metadata.json',
    );
    if (!fs.existsSync(capturedMainDebugMetadataPath)) {
      throw new Error(
        `Captured debug metadata asset should exist: ${capturedMainDebugMetadataPath}`,
      );
    }
    const mainDebugMetadata = JSON.parse(
      fs.readFileSync(capturedMainDebugMetadataPath, 'utf8'),
    );
    if (mainDebugMetadata.uiSourceMap?.version !== 1) {
      throw new Error(
        'Main debug metadata should expose uiSourceMap version 1',
      );
    }
    if (
      !Array.isArray(mainDebugMetadata.uiSourceMap?.sources)
      || !Array.isArray(mainDebugMetadata.uiSourceMap?.mappings)
      || !Array.isArray(mainDebugMetadata.uiSourceMap?.uiMaps)
      || mainDebugMetadata.uiSourceMap.mappings.length === 0
      || mainDebugMetadata.uiSourceMap.uiMaps.length === 0
      || (
        mainDebugMetadata.uiSourceMap.mappings.length
          !== mainDebugMetadata.uiSourceMap.uiMaps.length
      )
    ) {
      throw new Error('Main debug metadata should contain uiSourceMap records');
    }
    if (
      !mainDebugMetadata.uiSourceMap.sources.includes('index.jsx')
    ) {
      throw new Error(
        'Main debug metadata should include index.jsx records',
      );
    }
    if (
      !mainDebugMetadata.uiSourceMap.uiMaps.some(uiMap =>
        Number.isInteger(uiMap)
      )
    ) {
      throw new Error(
        'Main debug metadata uiMaps should contain uiSourceMap values',
      );
    }
    if (
      !mainDebugMetadata.uiSourceMap.mappings.some((mapping, index) =>
        Array.isArray(mapping)
        && mapping.length === 3
        && Number.isInteger(mainDebugMetadata.uiSourceMap.uiMaps[index])
        && mainDebugMetadata.uiSourceMap.sources[mapping[0]] === 'index.jsx'
      )
    ) {
      throw new Error('Main debug metadata uiMaps should point to index.jsx');
    }
    if (
      !mainDebugMetadata.uiSourceMap.mappings.some(mapping =>
        Array.isArray(mapping)
        && mapping.length === 3
        && mainDebugMetadata.uiSourceMap.sources[mapping[0]] === 'index.jsx'
      )
    ) {
      throw new Error('Main debug metadata mappings should point to index.jsx');
    }
    if (
      typeof mainDebugMetadata.meta?.templateDebug?.templateUrl !== 'string'
      || typeof mainDebugMetadata.meta?.templateDebug?.templateDebugUrl
        !== 'string'
    ) {
      throw new Error(
        'Main debug metadata should include templateDebug URLs in meta',
      );
    }

    const asyncRoot = path.join(compiler.outputPath, '.rspeedy/async');
    const asyncEntries = fs.readdirSync(asyncRoot, { recursive: true });
    const asyncDebugMetadataFile = asyncEntries.find(entry =>
      entry.endsWith('debug-metadata.json')
    );
    if (asyncDebugMetadataFile) {
      throw new Error(
        'Async debug metadata asset should be cleaned after encode',
      );
    }

    const capturedAsyncDebugMetadataFile = asyncEntries.find(entry =>
      entry.endsWith('captured-debug-metadata.json')
    );
    if (!capturedAsyncDebugMetadataFile) {
      throw new Error('Captured async debug metadata asset should exist');
    }

    const asyncDebugMetadata = JSON.parse(
      fs.readFileSync(
        path.join(asyncRoot, capturedAsyncDebugMetadataFile),
        'utf8',
      ),
    );
    if (asyncDebugMetadata.uiSourceMap?.version !== 1) {
      throw new Error(
        'Async debug metadata should expose uiSourceMap version 1',
      );
    }
    if (
      !Array.isArray(asyncDebugMetadata.uiSourceMap?.sources)
      || !Array.isArray(asyncDebugMetadata.uiSourceMap?.mappings)
      || !Array.isArray(asyncDebugMetadata.uiSourceMap?.uiMaps)
      || asyncDebugMetadata.uiSourceMap.mappings.length === 0
      || asyncDebugMetadata.uiSourceMap.uiMaps.length === 0
      || (
        asyncDebugMetadata.uiSourceMap.mappings.length
          !== asyncDebugMetadata.uiSourceMap.uiMaps.length
      )
    ) {
      throw new Error(
        'Async debug metadata should contain uiSourceMap records',
      );
    }
    if (
      !asyncDebugMetadata.uiSourceMap.sources.includes('lazy.jsx')
    ) {
      throw new Error(
        'Async debug metadata should include lazy.jsx records',
      );
    }
    if (
      !asyncDebugMetadata.uiSourceMap.uiMaps.some(uiMap =>
        Number.isInteger(uiMap)
      )
    ) {
      throw new Error(
        'Async debug metadata uiMaps should contain uiSourceMap values',
      );
    }
    if (
      !asyncDebugMetadata.uiSourceMap.mappings.some((mapping, index) =>
        Array.isArray(mapping)
        && mapping.length === 3
        && Number.isInteger(asyncDebugMetadata.uiSourceMap.uiMaps[index])
        && asyncDebugMetadata.uiSourceMap.sources[mapping[0]] === 'lazy.jsx'
      )
    ) {
      throw new Error('Async debug metadata uiMaps should point to lazy.jsx');
    }
    if (
      !asyncDebugMetadata.uiSourceMap.mappings.some(mapping =>
        Array.isArray(mapping)
        && mapping.length === 3
        && asyncDebugMetadata.uiSourceMap.sources[mapping[0]] === 'lazy.jsx'
      )
    ) {
      throw new Error(
        'Async debug metadata mappings should point to lazy.jsx',
      );
    }
    if (
      typeof asyncDebugMetadata.meta?.templateDebug?.templateUrl !== 'string'
      || typeof asyncDebugMetadata.meta?.templateDebug?.templateDebugUrl
        !== 'string'
    ) {
      throw new Error(
        'Async debug metadata should include templateDebug URLs in meta',
      );
    }
  },
};
