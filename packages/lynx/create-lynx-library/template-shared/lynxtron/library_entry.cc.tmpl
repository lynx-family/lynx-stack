#if defined(_WIN32)
#define LYNX_LIBRARY_NODE_EXPORT __declspec(dllexport)
#else
#define LYNX_LIBRARY_NODE_EXPORT __attribute__((visibility("default")))
#endif

using NodeEnv = void*;
using NodeValue = void*;

#if defined(LYNX_LIBRARY_HAS_NAPI_NATIVE_MODULES)
extern "C" void LynxAutolinkRegisterNapiNativeModules();
#endif

extern "C" LYNX_LIBRARY_NODE_EXPORT NodeValue
napi_register_module_v1(NodeEnv env, NodeValue exports) {
  (void)env;
#if defined(LYNX_LIBRARY_HAS_NAPI_NATIVE_MODULES)
  LynxAutolinkRegisterNapiNativeModules();
#endif
  return exports;
}
