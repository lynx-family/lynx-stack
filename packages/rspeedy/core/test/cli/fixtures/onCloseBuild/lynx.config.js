export default {
  plugins: [
    {
      name: 'test',
      setup(api) {
        api.onCloseBuild(() => {
          throw new Error('onCloseBuild')
        })
      },
    },
  ],
}
