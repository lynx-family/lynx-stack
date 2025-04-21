// @ts-check
import { chromium } from '@playwright/test';
import cases from './tests/lighthouse.cases.js';

const port = process.env.PORT ?? 3080;
const config = {
  ci: {
    // Use the recommended Lighthouse CI preset
    preset: 'lighthouse:recommended',
    collect: {
      // Configure Lighthouse collection settings
      settings: {
        chromeFlags: [
          '--no-sandbox',
          '--headless=new',
          '--disable-gpu',
          '--disable-dev-shm-usage',
        ],
        onlyCategories: ['performance'],
        formFactor: 'mobile',
        throttlingMethod: 'simulate',
        // Configure throttling settings
        throttling: {
          rttMs: 0,
          cpuSlowdownMultiplier: 2,
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
      chromePath: chromium.executablePath(),
      numberOfRuns: 3,
      url: cases.map(e => `http://localhost:${port}${e.matchingUrlPattern}`),
      startServerCommand: 'pnpm run serve',
    },
    'assert': {
      'assertMatrix': cases.map(e => ({
        ...e,
        'matchingUrlPattern': `.*${e.matchingUrlPattern}`,
      })),
    },
    upload: {
      target: 'temporary-public-storage',
      githubAppToken: process.env['CODECOV_TOKEN'],
    },
  },
};

// https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require
export { config as 'module.exports' };
