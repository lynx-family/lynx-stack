plugins {
  id("com.android.library")
}

android {
  namespace = "__ANDROID_PACKAGE__"
  compileSdk = 35

  defaultConfig {
    minSdk = 23
  }
}

dependencies {
  implementation("org.lynxsdk.lynx:lynx:0.0.1-alpha.1")
  implementation("org.lynxsdk.lynx:service-api:0.0.1-alpha.1")
  annotationProcessor("org.lynxsdk.lynx:lynx-processor:0.0.1-alpha.1")
}
