use crate::transform_mode::TransformMode as CoreMode;

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum TransformMode {
  /// Transform for production.
  Production,
  /// Transform for development.
  Development,
  /// Transform for testing.
  Test,
}

impl From<TransformMode> for CoreMode {
  fn from(val: TransformMode) -> Self {
    match val {
      TransformMode::Production => CoreMode::Production,
      TransformMode::Development => CoreMode::Development,
      TransformMode::Test => CoreMode::Test,
    }
  }
}

impl From<CoreMode> for TransformMode {
  fn from(val: CoreMode) -> Self {
    match val {
      CoreMode::Production => TransformMode::Production,
      CoreMode::Development => TransformMode::Development,
      CoreMode::Test => TransformMode::Test,
    }
  }
}

impl napi::bindgen_prelude::FromNapiValue for TransformMode {
  unsafe fn from_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    napi_val: napi::bindgen_prelude::sys::napi_value,
  ) -> napi::bindgen_prelude::Result<Self> {
    let val = <&str>::from_napi_value(env, napi_val).map_err(|e| {
      napi::bindgen_prelude::error!(
        e.status,
        "Failed to convert napi value into enum `{}`. {}",
        "TransformMode",
        e,
      )
    })?;
    match val {
      "production" => Ok(TransformMode::Production),
      "development" => Ok(TransformMode::Development),
      "test" => Ok(TransformMode::Test),
      _ => Err(napi::bindgen_prelude::error!(
        napi::bindgen_prelude::Status::InvalidArg,
        "value `{}` does not match any variant of enum `{}`",
        val,
        "TransformMode"
      )),
    }
  }
}

impl napi::bindgen_prelude::ToNapiValue for TransformMode {
  unsafe fn to_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    val: Self,
  ) -> napi::bindgen_prelude::Result<napi::bindgen_prelude::sys::napi_value> {
    let val = match val {
      TransformMode::Production => "production",
      TransformMode::Development => "development",
      TransformMode::Test => "test",
    };
    <&str>::to_napi_value(env, val)
  }
}
