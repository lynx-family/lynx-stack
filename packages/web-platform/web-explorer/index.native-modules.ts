export default {
  ExplorerModule: function(NativeModules, NativeModulesCall) {
    return {
      openSchema(value) {
        NativeModulesCall('openSchema', value);
      },
      openScan() {
        NativeModulesCall('openScan');
      },
    };
  },
};
