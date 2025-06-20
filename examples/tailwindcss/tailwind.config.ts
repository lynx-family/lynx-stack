import type { Config } from 'tailwindcss';

import preset from '@lynx-js/tailwind-preset';

export default {
  content: [],
  presets: [preset],
  corePlugins: { inset: false },
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
    },
  },
} satisfies Config;
