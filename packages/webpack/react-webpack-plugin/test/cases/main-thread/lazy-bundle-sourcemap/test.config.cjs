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
  },
};
