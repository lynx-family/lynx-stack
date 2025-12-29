export default {
  color_environment: function(NapiModules, NapiModulesCall) {
    return {
      getColor() {
        NapiModules.color_methods.getColor({ color: 'green' }, data => {
          console.log(data.color);
          console.log(data.tagName);
        });
      },
      ColorEngine: class ColorEngine {
        getColor(name) {
          NapiModules.color_methods.getColor({ color: 'green' }, data => {
            console.log(data.color);
            console.log(data.tagName);
          });
        }
      },
    };
  },
  color_methods: function(NapiModules, NapiModulesCall) {
    return {
      async getColor(data, callback) {
        const handledData = await NapiModulesCall('getColor', data);
        callback(handledData);
      },
    };
  },
  event_method: function(NapiModules, NapiModulesCall, handleDispatch) {
    return {
      async bindEvent() {
        await NapiModulesCall('bindEvent');
        handleDispatch((data) => console.log(`bts:${data}`));
      },
    };
  },
};
