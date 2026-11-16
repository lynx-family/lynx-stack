export const marker = 42

export function getView() {
  'background only'
  return import(/* webpackMode: "eager" */ './view.js')
}
