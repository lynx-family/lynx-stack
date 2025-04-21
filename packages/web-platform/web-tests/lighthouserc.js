import playwright from 'playwright';

export default {
  ci: {
    // Use the recommended Lighthouse CI preset
    preset: 'lighthouse:recommended',
    collect: {
      // Configure Lighthouse collection settings
      settings: {
        // Set the path to the Chrome executable dynamically
        // using the playwright package. This ensures the correct
        // Chromium binary installed by Playwright is used.
        chromePath: playwright.chromium.executablePath(),
        // You might need to add chromeFlags if running in certain CI environments
        // e.g., inside a Docker container without a display server
        chromeFlags: ['--no-sandbox', '--headless=new', '--disable-gpu'],
      },
      // Add URLs to audit here if not using startServerCommand
      // url: ['http://localhost:3000'],
      // Or specify a command to start your server
      // startServerCommand: 'npm run start',
    },
    // Configure assertion thresholds (optional)
    // assert: {
    //   preset: 'lighthouse:recommended',
    //   assertions: {
    //     'categories:performance': ['warn', { minScore: 0.9 }],
    //     'categories:accessibility': ['error', { minScore: 1 }],
    //   },
    // },
    // Configure upload target (optional)
    // upload: {
    //   target: 'temporary-public-storage', // Or 'lhci', 'filesystem', etc.
    // },
  },
};
