// @ts-check
import { chromium } from '@playwright/test';
import cases from './tests/lighthouse.cases.js';

const port = process.env.PORT ?? 3080;
const isCI = !!process.env['CI'];
const config = {
  ci: {
    // Use the recommended Lighthouse CI preset
    preset: 'lighthouse:recommended',
    collect: {
      // Configure Lighthouse collection settings
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
        ],
        onlyCategories: ['performance'],
        formFactor: 'mobile',
        throttlingMethod: 'simulate',
        // Configure throttling settings
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
      githubAppToken: process.env['LHCI_GITHUB_APP_TOKEN'],
      githubToken: process.env['LHCI_GITHUB_APP_TOKEN']
        ? undefined
        : process.env['GITHUB_TOKEN'],
    },
  },
};

// https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require
export { config as 'module.exports' };
