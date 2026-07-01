use lynx::{
  sys, Env, Error, FetchResponse, GenericResourceFetcher, HeadlessView, LynxGroup, NoopHost,
  ResourceFetcher, ResourceRequest, ResourceType, SoftwareFrame, SoftwareRenderer,
  WindowlessRenderer,
};
use std::env;
use std::ffi::c_void;
use std::sync::{
  atomic::{AtomicUsize, Ordering},
  Arc, Mutex, MutexGuard, OnceLock,
};

#[test]
fn public_data_types_work_without_runtime() {
  assert_eq!(FetchResponse::ok([1, 2, 3]).data, Some(vec![1, 2, 3]));
  assert_eq!(FetchResponse::empty_ok().code, 0);
  assert_eq!(
    FetchResponse::error(-7, "missing").error_message.as_deref(),
    Some("missing")
  );
  assert_eq!(
    ResourceType::from(sys::kLynxResourceTypeImage),
    ResourceType::Image
  );
  assert_eq!(ResourceType::from(123_456), ResourceType::Unknown(123_456));
}

#[test]
fn software_frame_exposes_presented_bytes() {
  let bytes = [10, 20, 30, 40, 50, 60, 70, 80];
  let frame = SoftwareFrame {
    allocation: bytes.as_ptr().cast::<c_void>(),
    row_bytes: 4,
    height: 2,
  };

  assert_eq!(frame.byte_len(), Some(bytes.len()));
  assert_eq!(unsafe { frame.bytes() }, Some(bytes.as_slice()));

  let overflowing = SoftwareFrame {
    allocation: bytes.as_ptr().cast::<c_void>(),
    row_bytes: usize::MAX,
    height: 2,
  };
  assert_eq!(overflowing.byte_len(), None);
}

#[test]
fn runtime_env_loads_and_process_settings_are_callable() {
  let _guard = runtime_test_guard();
  let env = configured_env();

  assert!(env.sys().path.is_file());
  assert!(!env.sdk_version().is_empty());
  let _ = env.icu_data_path();

  let original_devtool = env.is_devtool_enabled();
  env.set_devtool_enabled(!original_devtool);
  env.set_devtool_enabled(original_devtool);

  let original_logbox = env.is_logbox_enabled();
  env.set_logbox_enabled(!original_logbox);
  env.set_logbox_enabled(original_logbox);

  assert_interior_nul(env.set_icu_data_path("bad\0icu"), "icu_data_path");
}

#[test]
fn runtime_builds_headless_view_and_validates_bundle_errors() {
  let _guard = runtime_test_guard();
  let env = configured_env();

  let renderer = WindowlessRenderer::software(&env, CountingSoftwareRenderer::default(), NoopHost)
    .expect("create software renderer");
  let fetcher = GenericResourceFetcher::new(&env, StaticFetcher).expect("create resource fetcher");
  drop(fetcher);

  let mut group =
    LynxGroup::with_id(&env, "integration", "runtime").expect("create Lynx group with id");
  group
    .set_preload_js_paths(["/tmp/lynx_core.js"])
    .expect("set preload JS paths");
  group.set_enable_js_group_thread(false);

  let view = HeadlessView::builder(env.clone(), renderer)
    .viewport(320.0, 240.0, 2.0)
    .font_scale(1.2)
    .resource_fetcher(StaticFetcher)
    .expect("attach resource fetcher")
    .lynx_group(group)
    .build()
    .expect("build headless view");

  view.update_screen_metrics(640.0, 480.0, 1.5);
  view.set_frame(4.0, 8.0, 320.0, 240.0);
  view.set_font_scale(1.0);
  view.enter_foreground();
  view
    .send_global_event("integration", "{\"ok\":true}")
    .expect("send global event");
  assert_interior_nul(
    view.send_global_event("bad\0event", "{}"),
    "global_event_name",
  );
  view
    .update_data_json("{\"count\":1}", Some("{\"theme\":\"dark\"}"))
    .expect("update data JSON");
  assert_interior_nul(
    view.update_data_json("bad\0json", None),
    "template_data_json",
  );
  assert_interior_nul(
    view.reload_template(Some("bad\0json"), None),
    "template_data_json",
  );
  view.enter_background();

  let bundle_error = view
    .load_template_bundle_bytes(
      "memory://invalid.lynx.bundle",
      b"not a template bundle",
      None,
    )
    .expect_err("invalid template bundle should be rejected");
  assert!(bundle_error
    .to_string()
    .contains("failed to decode template bundle"));
}

#[test]
fn runtime_public_methods_reject_interior_nul_before_ffi() {
  let _guard = runtime_test_guard();
  let env = configured_env();

  assert_interior_nul(LynxGroup::new(&env, "bad\0group").map(|_| ()), "group_name");

  let renderer = WindowlessRenderer::software(&env, CountingSoftwareRenderer::default(), NoopHost)
    .expect("create software renderer");
  assert_interior_nul(
    HeadlessView::builder(env, renderer)
      .icu_data_path("bad\0icu")
      .map(|_| ()),
    "icu_data_path",
  );
}

fn configured_env() -> Env {
  if env::var_os("LYNX_LIB_PATH").is_none() && env::var_os("LYNX_SDK_DIR").is_none() {
    panic!(
      "runtime integration tests require LYNX_LIB_PATH or LYNX_SDK_DIR; run \
       `python3 tools/download_runtime.py --emit-env` from lynx/engine-bridge"
    );
  }
  Env::load().expect("load configured Lynx runtime")
}

fn runtime_test_guard() -> MutexGuard<'static, ()> {
  static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
  LOCK
    .get_or_init(|| Mutex::new(()))
    .lock()
    .expect("runtime integration test lock poisoned")
}

fn assert_interior_nul(result: lynx::Result<()>, expected_field: &'static str) {
  match result {
    Err(Error::InteriorNul { field }) => assert_eq!(field, expected_field),
    other => panic!("expected InteriorNul for {expected_field}, got {other:?}"),
  }
}

#[derive(Default)]
struct CountingSoftwareRenderer {
  presents: Arc<AtomicUsize>,
}

impl SoftwareRenderer for CountingSoftwareRenderer {
  fn present(&mut self, frame: SoftwareFrame) -> bool {
    assert!(frame.byte_len().is_some());
    self.presents.fetch_add(1, Ordering::Relaxed);
    true
  }
}

struct StaticFetcher;

impl ResourceFetcher for StaticFetcher {
  fn fetch(&mut self, request: ResourceRequest) -> FetchResponse {
    FetchResponse::error(404, format!("fixture resource not found: {}", request.url))
  }

  fn fetch_path(&mut self, request: ResourceRequest) -> FetchResponse {
    FetchResponse::error(
      404,
      format!("fixture resource path not found: {}", request.url),
    )
  }
}
