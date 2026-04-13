use sha1::{Digest, Sha1};

pub struct WorkletHash {
  last_id: i32,
}

impl WorkletHash {
  pub fn new() -> Self {
    WorkletHash { last_id: 0 }
  }

  pub fn gen(&mut self, filename: &str, content_hash: &str) -> String {
    self.last_id += 1;
    format!(
      "{}:{}:{}",
      Self::calc_hash(filename),
      content_hash,
      self.last_id
    )
  }

  pub fn calc_module_hash(filename: &str, content_hash: &str) -> String {
    format!("{}-{}", Self::calc_hash(filename), content_hash)
  }

  fn calc_hash(s: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(s.as_bytes());
    let sum = hasher.finalize();

    hex::encode(sum)[0..4].to_string()
  }
}
