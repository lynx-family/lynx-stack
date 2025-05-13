import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import fs from 'node:fs/promises';
import { exec } from 'child_process';
import { fileURLToPath } from 'node:url';
import cases from '../tests/lighthouse.cases.js';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isCI = !!process.env['CI'];
const port = process.env.PORT ?? 3080;
const timesToRun = 3;
const maxRetries = 3;

function wait(ws) {
  return new Promise(resolve => {
    setTimeout(resolve, ws);
  });
}

/**
 * Checks whether a number satisfies a specified condition.
 *
 * @param {number} num The number to check.
 * @param {Array} conditions Condition array, the first element is an error type string, the second element is an object containing the maximum value or minimum score.
 * @returns {boolean} Returns true if the number satisfies the condition, otherwise returns false or string.
 */
function checkNumber(num, conditions) {
  if (typeof num !== 'number' || isNaN(num)) {
    return 'Invalid numeric input.';
  }
  if (
    !Array.isArray(conditions) || conditions.length !== 2
    || typeof conditions[0] !== 'string' || typeof conditions[1] !== 'object'
  ) {
    return 'Invalid criteria array.';
  }

  const errorType = conditions[0];
  const conditionObject = conditions[1];

  if (errorType === 'error') {
    if (conditionObject.hasOwnProperty('maxNumericValue')) {
      return num <= conditionObject.maxNumericValue;
    } else if (conditionObject.hasOwnProperty('minScore')) {
      return num >= conditionObject.minScore;
    } else {
      return 'The condition object must contain either a maxNumericValue or a minScore property.';
    }
  }
}

const safeKillChrome = (chrome) => {
  try {
    chrome.kill();
  } catch (e) {}
};

const runBenchmark = async () => {
  const results = [];

  for (let i = 0; i < cases.length; i++) {
    for (let j = 0; j < timesToRun; j++) {
      let retries = 0;
      let result;

      while (retries < maxRetries) {
        try {
          const chrome = await launch({
            chromeFlags: [
              '--no-sandbox',
              '--disable-gpu',
              '--disable-dev-shm-usage',
              '--browser-test',
              '--headless',
            ],
          });
          result = await lighthouse(
            `http://localhost:${port}${cases[i].matchingUrlPattern}`,
            {
              output: 'json',
              port: chrome.port,
            },
            {
              extends: 'lighthouse:default',
              settings: {
                // this test causes a crash
                skipAudits: [
                  // do not run these audit related to network io
                  'bf-cache',
                  'uses-http2',
                  'uses-text-compression',
                  'uses-optimized-images',
                  'modern-image-formats',
                  'unused-javascript',
                  'unused-css-rules',
                  'unminified-css',
                  'render-blocking-resources',
                  'total-byte-weight',
                  'uses-long-cache-ttl',
                  'redirects',
                  'network-server-latency',
                  'network-rtt',
                  'network-requests',
                  'full-page-screenshot',
                ],
                chromeFlags: [
                  '--no-sandbox',
                  '--disable-gpu',
                  '--disable-dev-shm-usage',
                  '--browser-test',
                  '--headless',
                ],
                onlyCategories: ['performance'],
                formFactor: 'mobile',
                // Configure throttling settings
                throttlingMethod: 'devtools',
                throttling: {
                  rttMs: 0,
                  cpuSlowdownMultiplier: isCI ? 2.3 : 4,
                  requestLatencyMs: 0,
                  downloadThroughputKbps: 99999,
                  uploadThroughputKbps: 99999,
                  throughputKbps: 99999,
                },
                'screenEmulation': {
                  'mobile': true,
                  'width': 412,
                  'height': 823,
                  'deviceScaleFactor': 1.75,
                  'disabled': true,
                },
              },
            },
          );

          // retry
          if (result.lhr.runtimeError) {
            console.error('runtimeError', result.lhr.runtimeError);
            retries++;
            await wait(500);
            safeKillChrome();
            continue;
          }

          safeKillChrome();
          break;
        } catch (e) {
          console.error('error', e);
          retries++;
          await wait(500);
          safeKillChrome();
          if (retries === maxRetries) {
            throw new Error('Maximum retries reached');
          }
          continue;
        }
      }

      Object.entries(cases[i].assertions).forEach(([key, value]) => {
        const splitKey = key.split(':');
        if (splitKey.length === 1) {
          if (
            checkNumber(result.lhr.audits[splitKey[0]].numericValue, value)
              !== true
          ) {
            throw new Error(
              `Assertion ${
                cases[i].matchingUrlPattern
              } failed for ${key} with value ${
                result.lhr.audits[splitKey[0]].numericValue
              }`,
            );
          }
        }

        if (splitKey.length === 2) {
          const [category, metric] = key.split(':');
          if (
            checkNumber(result.lhr[category][metric].score, value)
              !== true
          ) {
            throw new Error(
              `Assertion ${
                cases[i].matchingUrlPattern
              } failed for ${key} with value ${
                result.lhr[category][metric].score
              }`,
            );
          }
        }
      });

      results.push(result.lhr);
      await wait(500);
      safeKillChrome();
    }
  }

  await fs.mkdir(path.resolve(__dirname, '../playwright-report'));
  fs.writeFile(
    path.resolve(__dirname, '../playwright-report/lighthouse-report.json'),
    JSON.stringify(results, null, 2),
  );
};

const runLighthouse = async () => {
  const serverProcess = exec('pnpm run serve', {
    stdio: 'inherit',
  }, (error, stdout, stderr) => {
    if (error) {
      console.error(`pnpm run serve error: ${error.message}`);
      process.exit(1);
    }
    if (stderr) {
      console.error(`pnpm run serve stderr: ${stderr}`);
      process.exit(1);
    }
  });
  await wait(1000);
  try {
    await runBenchmark();
  } catch (e) {
    console.error('error runBenchmark', e);
    serverProcess.unref();
    serverProcess.kill();
    process.exit(1);
  }
  serverProcess.unref();
  serverProcess.kill();
  process.exit(0);
};

runLighthouse();
