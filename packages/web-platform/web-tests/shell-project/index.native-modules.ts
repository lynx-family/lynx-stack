export default {
  CustomModule: function(NativeModules, NativeModulesCall) {
    return {
      async getColor(data, callback) {
        const color = await NativeModulesCall('getColor', data);
        callback(color);
      },
    };
  },
};
