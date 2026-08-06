import type { Config } from 'tailwindcss';

import preset from '@lynx-js/tailwind-preset';

const config: Config = {
  content: [],
  presets: [preset],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'var(--canvas)',
          ambient: 'var(--canvas-ambient)',
        },
        paper: {
          DEFAULT: 'var(--paper)',
          clear: 'var(--paper-clear)',
          veil: 'var(--paper-veil)',
          film: 'var(--paper-film)',
        },
        backdrop: {
          DEFAULT: 'var(--backdrop)',
          subtle: 'var(--backdrop-subtle)',
          heavy: 'var(--backdrop-heavy)',
        },
        content: {
          DEFAULT: 'var(--content)',
          2: 'var(--content-2)',
          muted: 'var(--content-muted)',
          subtle: 'var(--content-subtle)',
          faint: 'var(--content-faint)',
          faded: 'var(--content-faded)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          2: 'var(--primary-2)',
          muted: 'var(--primary-muted)',
          content: 'var(--primary-content)',
          'content-faded': 'var(--primary-content-faded)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          2: 'var(--secondary-2)',
          content: 'var(--secondary-content)',
          'content-faded': 'var(--secondary-content-faded)',
        },
        neutral: {
          DEFAULT: 'var(--neutral)',
          2: 'var(--neutral-2)',
          subtle: 'var(--neutral-subtle)',
          faint: 'var(--neutral-faint)',
          ambient: 'var(--neutral-ambient)',
          veil: 'var(--neutral-veil)',
          film: 'var(--neutral-film)',
          content: 'var(--neutral-content)',
          'content-faded': 'var(--neutral-content-faded)',
        },
        line: 'var(--line)',
        rule: 'var(--rule)',
        border: 'var(--line)',
        divider: 'var(--line)',
        ring: 'var(--rule)',
        outline: 'var(--rule)',
        field: 'var(--paper)',
        input: 'var(--paper)',
      },
      keyframes: {
        'fade-in': {
          from: {
            opacity: '0',
          },
          to: {
            opacity: '1',
          },
        },
        'fade-out': {
          from: {
            opacity: '1',
          },
          to: {
            opacity: '0',
          },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-out',
      },
    },
  },
};

export default config;
