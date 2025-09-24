export default {
  custom_module: function(NapiModules, NapiModulesCall) {
    return {
      async test(name) {
        console.log('CustomModule', NapiModules, NapiModulesCall);
      },
    };
  },
};
