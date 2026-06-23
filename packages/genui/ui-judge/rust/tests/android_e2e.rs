// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use image::GenericImageView;
use serial_test::serial;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use tokio::time::sleep;
use ui_judge::{ConnectOptions, Lynx, ScreenshotOptions};

struct FixtureServer {
  shutdown: Option<oneshot::Sender<()>>,
  task: JoinHandle<()>,
}

impl Drop for FixtureServer {
  fn drop(&mut self) {
    if let Some(shutdown) = self.shutdown.take() {
      let _ = shutdown.send(());
    }
    self.task.abort();
  }
}

#[tokio::test(flavor = "multi_thread")]
#[serial]
#[ignore = "requires Android emulator/device with Lynx Explorer installed"]
async fn android_e2e() {
  let _server = start_fixture_server().await;

  let lynx = Lynx::connect(connect_options())
    .await
    .expect("connect to Lynx Explorer");
  lynx.reverse(3001, 3001).await.expect("set adb reverse");

  let mut page = lynx.new_page();
  let fixture_url = unique_fixture_url();
  page
    .goto(&fixture_url, Duration::from_secs(15))
    .await
    .expect("navigate to fixture");

  let content = page.content().await.expect("read DOM content");
  assert!(content.contains("have fun"), "{content}");

  let title = page
    .locator(".Title")
    .await
    .expect("query title")
    .expect("title exists");
  assert_eq!(
    title
      .get_attribute("class")
      .await
      .expect("class attr")
      .as_deref(),
    Some("Title")
  );
  assert_eq!(
    title
      .get_attribute("text")
      .await
      .expect("text attr")
      .as_deref(),
    Some("React")
  );

  let styles = title.computed_style_map().await.expect("computed style");
  assert!(styles.contains_key("display"));

  assert!(page
    .locator(".Logo--lynx")
    .await
    .expect("query lynx logo")
    .is_some());

  let logo = page
    .locator(".Logo")
    .await
    .expect("query logo")
    .expect("logo parent exists");
  logo.tap().await.expect("tap logo");
  sleep(Duration::from_millis(500)).await;

  let logo = page
    .locator(".Logo")
    .await
    .expect("query logo after first tap")
    .expect("logo parent exists after first tap");
  logo.tap().await.expect("tap logo again");
  sleep(Duration::from_millis(500)).await;

  let screenshot = page
    .screenshot(ScreenshotOptions::default())
    .await
    .expect("take screenshot");
  assert!(!screenshot.is_empty());
  assert_screenshot_is_not_white(&screenshot);

  lynx.remove_reverse(3001).await.expect("remove adb reverse");
}

fn unique_fixture_url() -> String {
  let millis = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .expect("system clock is after unix epoch")
    .as_millis();
  format!("http://127.0.0.1:3001/main-{millis}.lynx.bundle")
}

fn connect_options() -> ConnectOptions {
  ConnectOptions {
    clear_data: true,
    device_id: std::env::var("UI_JUDGE_ANDROID_DEVICE_ID")
      .ok()
      .or_else(|| std::env::var("ANDROID_SERIAL").ok()),
    ..Default::default()
  }
}

async fn start_fixture_server() -> FixtureServer {
  let fixture_path =
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/react/main.lynx.bundle");
  let bundle = Arc::new(
    tokio::fs::read(&fixture_path)
      .await
      .unwrap_or_else(|error| panic!("read fixture {}: {error}", fixture_path.display())),
  );
  let listener = TcpListener::bind(("127.0.0.1", 3001))
    .await
    .expect("bind fixture server on port 3001");
  let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
  let task = tokio::spawn(async move {
    loop {
      tokio::select! {
        _ = &mut shutdown_rx => break,
        accepted = listener.accept() => {
          let Ok((stream, _addr)) = accepted else {
            continue;
          };
          let bundle = Arc::clone(&bundle);
          tokio::spawn(async move {
            let _ = serve_fixture_request(stream, &bundle).await;
          });
        }
      }
    }
  });

  FixtureServer {
    shutdown: Some(shutdown_tx),
    task,
  }
}

async fn serve_fixture_request(mut stream: TcpStream, bundle: &[u8]) -> std::io::Result<()> {
  let mut request = [0_u8; 1024];
  let read = stream.read(&mut request).await?;
  let first_line = String::from_utf8_lossy(&request[..read])
    .lines()
    .next()
    .unwrap_or_default()
    .to_string();

  if first_line.starts_with("GET /") && first_line.contains(".lynx.bundle ") {
    write_response(&mut stream, "200 OK", "application/octet-stream", bundle).await?;
  } else {
    write_response(
      &mut stream,
      "404 Not Found",
      "text/plain; charset=utf-8",
      b"not found",
    )
    .await?;
  }

  stream.shutdown().await
}

async fn write_response(
  stream: &mut TcpStream,
  status: &str,
  content_type: &str,
  body: &[u8],
) -> std::io::Result<()> {
  stream
    .write_all(
      format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len(),
      )
      .as_bytes(),
    )
    .await?;
  stream.write_all(body).await
}

fn assert_screenshot_is_not_white(buffer: &[u8]) {
  let image = image::load_from_memory(buffer).expect("decode screenshot");
  let has_non_white_pixel = image.pixels().any(|(_, _, pixel)| {
    let [red, green, blue, _alpha] = pixel.0;
    red != 255 || green != 255 || blue != 255
  });
  assert!(has_non_white_pixel, "screenshot is completely white");
}
