export default {
  CustomModule: function(NativeModules, NativeModulesCall) {
    return {
      async test(data, callback) {
        console.log('CustomModule', NativeModules, NativeModulesCall);
      },
    };
  },
};
