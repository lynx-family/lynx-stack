import configs from '@lynx-js/eslint-config-reactlynx/ts'

export default [
  ...configs,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: ['dist/'],
  },
]
