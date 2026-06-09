use std::collections::HashMap;

use serde::ser::{Serialize, SerializeMap, SerializeSeq, Serializer};
use serde_json::Value;
use sha2::{Digest, Sha256};

const TEMPLATE_ID_PREFIX: &str = "_et_";
const TEMPLATE_ID_HASH_HEX_LEN: usize = 12;
const TEMPLATE_ID_HASH_BYTES: usize = TEMPLATE_ID_HASH_HEX_LEN / 2;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct TemplateIdentity {
  pub template_id: String,
  pub canonical_content: String,
}

#[derive(Default)]
pub(super) struct TemplateIdentityCollisionGuard {
  canonical_content_by_template_id: HashMap<String, String>,
}

pub(super) fn canonical_template_content(value: &Value) -> String {
  serde_json::to_string(&CanonicalTemplateValue(value))
    .expect("Template Definition canonical content must serialize")
}

pub(super) fn template_identity_from_compiled_template(value: &Value) -> TemplateIdentity {
  let canonical_content = canonical_template_content(value);
  let hash = Sha256::digest(canonical_content.as_bytes());
  let hash_hex = hash_hex_prefix(&hash);

  TemplateIdentity {
    template_id: format!("{}{}", TEMPLATE_ID_PREFIX, hash_hex),
    canonical_content,
  }
}

impl TemplateIdentityCollisionGuard {
  pub(super) fn register(&mut self, identity: &TemplateIdentity) {
    if let Some(existing) = self
      .canonical_content_by_template_id
      .get(&identity.template_id)
    {
      assert_eq!(
        existing, &identity.canonical_content,
        "ET Template Definition hash collision for {}",
        identity.template_id
      );
      return;
    }

    self.canonical_content_by_template_id.insert(
      identity.template_id.clone(),
      identity.canonical_content.clone(),
    );
  }
}

struct CanonicalTemplateValue<'a>(&'a Value);

impl Serialize for CanonicalTemplateValue<'_> {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    match self.0 {
      Value::Null => serializer.serialize_unit(),
      Value::Bool(value) => serializer.serialize_bool(*value),
      Value::Number(value) => value.serialize(serializer),
      Value::String(value) => serializer.serialize_str(value),
      Value::Array(items) => {
        let mut seq = serializer.serialize_seq(Some(items.len()))?;
        for item in items {
          seq.serialize_element(&CanonicalTemplateValue(item))?;
        }
        seq.end()
      }
      Value::Object(map) => {
        let mut entries = map.iter().collect::<Vec<_>>();
        entries.sort_by(|(left_key, _), (right_key, _)| left_key.cmp(right_key));
        let mut canonical = serializer.serialize_map(Some(entries.len()))?;
        for (key, value) in entries {
          canonical.serialize_entry(key, &CanonicalTemplateValue(value))?;
        }
        canonical.end()
      }
    }
  }
}

fn hash_hex_prefix(hash: &[u8]) -> String {
  const HEX: &[u8; 16] = b"0123456789abcdef";
  let mut out = String::with_capacity(TEMPLATE_ID_HASH_HEX_LEN);

  for byte in &hash[..TEMPLATE_ID_HASH_BYTES] {
    out.push(HEX[(byte >> 4) as usize] as char);
    out.push(HEX[(byte & 0x0f) as usize] as char);
  }

  out
}

#[cfg(test)]
mod tests {
  use serde_json::json;

  use super::{
    canonical_template_content, template_identity_from_compiled_template, TemplateIdentity,
    TemplateIdentityCollisionGuard,
  };

  #[test]
  fn canonical_content_sorts_object_keys_and_preserves_array_order() {
    let value = json!({
      "z": 1,
      "a": {
        "b": 2,
        "a": 1
      },
      "list": [
        {
          "d": 4,
          "c": 3
        },
        2
      ]
    });

    assert_eq!(
      canonical_template_content(&value),
      r#"{"a":{"a":1,"b":2},"list":[{"c":3,"d":4},2],"z":1}"#
    );
  }

  #[test]
  fn template_identity_uses_sha256_twelve_hex_prefix() {
    let identity = template_identity_from_compiled_template(&json!({
      "b": 1,
      "a": 2
    }));

    assert_eq!(identity.canonical_content, r#"{"a":2,"b":1}"#);
    assert_eq!(identity.template_id, "_et_d3626ac30a87");
  }

  #[test]
  #[should_panic(expected = "ET Template Definition hash collision")]
  fn collision_guard_rejects_same_id_with_different_canonical_content() {
    let mut guard = TemplateIdentityCollisionGuard::default();

    guard.register(&TemplateIdentity {
      template_id: "_et_collision".to_string(),
      canonical_content: r#"{"a":1}"#.to_string(),
    });
    guard.register(&TemplateIdentity {
      template_id: "_et_collision".to_string(),
      canonical_content: r#"{"a":2}"#.to_string(),
    });
  }
}
