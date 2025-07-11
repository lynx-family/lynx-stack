import configs from '@lynx-js/eslint-config-reactlynx'

export default [
  ...configs,
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['dist/'],
  },
]
