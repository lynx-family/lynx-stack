plugins {
  id("com.android.library")
}

__ANDROID_NAPI_BUILD_SETUP__
android {
  javaClass.methods.firstOrNull { it.name == "setNamespace" }
    ?.invoke(this, "__ANDROID_PACKAGE__")
  compileSdkVersion(35)

  defaultConfig {
    minSdkVersion(23)
__ANDROID_NAPI_DEFAULT_CONFIG__
  }
__ANDROID_NAPI_EXTERNAL_NATIVE_BUILD__
}

dependencies {
__ANDROID_PLATFORM_DEPENDENCIES__
__ANDROID_NAPI_DEPENDENCIES__
}
__ANDROID_NAPI_TASK_WIRING__
