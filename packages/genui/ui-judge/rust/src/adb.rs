// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::time::{Duration, Instant};

use droidrun_adb::{AdbDevice, AdbServer, DeviceState};
use tokio::time::sleep;

use crate::api::{Error, Result};

#[derive(Debug, Clone)]
pub struct AndroidDevice {
  inner: AdbDevice,
}

impl AndroidDevice {
  pub fn serial(&self) -> &str {
    &self.inner.serial
  }

  pub async fn choose(device_id: Option<&str>, package_name: &str) -> Result<Self> {
    let server = AdbServer::default();
    let devices = server.devices().await?;
    let candidates = devices
      .into_iter()
      .filter(|device| device.state == DeviceState::Device)
      .filter(|device| {
        device_id
          .map(|expected| expected == device.serial)
          .unwrap_or(true)
      })
      .collect::<Vec<_>>();

    if candidates.is_empty() {
      return Err(match device_id {
        Some(device_id) => Error::DeviceNotFound(device_id.to_string()),
        None => Error::NoDevice,
      });
    }

    for candidate in candidates {
      let device = server.device_by_serial(&candidate.serial).await?;
      let packages = device.list_packages(&[]).await?;
      if packages.iter().any(|package| package == package_name) {
        return Ok(Self { inner: device });
      }
    }

    Err(Error::PackageNotFound(package_name.to_string()))
  }

  pub async fn prepare_app(&self, package_name: &str, clear_data: bool) -> Result<()> {
    if clear_data {
      self.inner.app_clear(package_name).await?;
    }

    let _ = self.inner.app_stop(package_name).await;
    match self.inner.app_start(package_name, None).await {
      Ok(output) if !output.to_ascii_lowercase().contains("error") => {}
      _ => {
        let output = self
          .inner
          .shell(&format!(
            "monkey -p {package_name} -c android.intent.category.LAUNCHER 1"
          ))
          .await?;
        if !output.contains("Events injected:") {
          return Err(Error::AppLaunch(format!(
            "failed to launch {package_name}: {output}"
          )));
        }
      }
    }

    self
      .wait_for_process(package_name, Duration::from_secs(20))
      .await
  }

  pub async fn wait_for_process(&self, package_name: &str, timeout: Duration) -> Result<()> {
    let start = Instant::now();
    while start.elapsed() < timeout {
      let output = self
        .inner
        .shell(&format!("pidof {package_name}"))
        .await
        .unwrap_or_default();
      if !output.trim().is_empty() {
        return Ok(());
      }
      sleep(Duration::from_secs(1)).await;
    }

    Err(Error::Timeout(format!(
      "timed out waiting for Android process {package_name}"
    )))
  }

  pub async fn reverse(&self, remote_port: u16, local_port: u16) -> Result<()> {
    Ok(self.inner.reverse(remote_port, local_port).await?)
  }

  pub async fn remove_reverse(&self, remote_port: u16) -> Result<()> {
    Ok(self.inner.reverse_remove(remote_port).await?)
  }

  pub async fn forward(&self, remote_port: u16) -> Result<u16> {
    Ok(self.inner.forward(0, remote_port).await?)
  }

  pub async fn remove_forward(&self, local_port: u16) -> Result<()> {
    Ok(self.inner.forward_remove(local_port).await?)
  }
}
