import type { Config } from 'tailwindcss';

import preset from '@lynx-js/tailwind-preset';

const config: Config = {
  content: [],
  presets: [preset],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: 'var(--color-base-1)',
          1: 'var(--color-base-1)',
          2: 'var(--color-base-2)',
          3: 'var(--color-base-3)',
          4: 'var(--color-base-4)',
          content: 'var(--color-base-content)',
        },
        content: 'var(--color-base-content)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          content: 'var(--color-primary-content)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          content: 'var(--color-secondary-content)',
        },
        muted: {
          DEFAULT: 'var(--color-muted)',
          content: 'var(--color-muted-content)',
        },
        neutral: {
          DEFAULT: 'var(--color-neutral)',
          content: 'var(--color-neutral-content)',
        },
        border: 'var(--color-border)',
        divider: 'var(--color-border)',
        ring: 'var(--color-ring)',
        outline: 'var(--color-ring)',
        field: 'var(--color-field)',
        input: 'var(--color-field)',
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
