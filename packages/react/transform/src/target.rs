#[allow(clippy::upper_case_acronyms)]
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum TransformTarget {
  LEPUS,
  JS,
  MIXED,
}

impl napi::bindgen_prelude::FromNapiValue for TransformTarget {
  unsafe fn from_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    napi_val: napi::bindgen_prelude::sys::napi_value,
  ) -> napi::bindgen_prelude::Result<Self> {
    let val = <&str>::from_napi_value(env, napi_val).map_err(|e| {
      napi::bindgen_prelude::error!(
        e.status,
        "Failed to convert napi value into enum `{}`. {}",
        "TransformTarget",
        e,
      )
    })?;
    match val {
      "LEPUS" => Ok(TransformTarget::LEPUS),
      "JS" => Ok(TransformTarget::JS),
      "MIXED" => Ok(TransformTarget::MIXED),
      _ => Err(napi::bindgen_prelude::error!(
        napi::bindgen_prelude::Status::InvalidArg,
        "value `{}` does not match any variant of enum `{}`",
        val,
        "TransformTarget"
      )),
    }
  }
}

impl napi::bindgen_prelude::ToNapiValue for TransformTarget {
  unsafe fn to_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    val: Self,
  ) -> napi::bindgen_prelude::Result<napi::bindgen_prelude::sys::napi_value> {
    let val = match val {
      TransformTarget::LEPUS => "LEPUS",
      TransformTarget::JS => "JS",
      TransformTarget::MIXED => "MIXED",
    };
    <&str>::to_napi_value(env, val)
  }
}
