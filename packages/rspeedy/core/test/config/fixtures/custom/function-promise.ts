export default () =>
  new Promise(p =>
    p({
      source: { entry: 'default' },
    })
  )
