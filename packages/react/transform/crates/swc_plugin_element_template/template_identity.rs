use std::collections::HashMap;

use serde_json::Value;
use sha2::{Digest, Sha256};

const TEMPLATE_ID_PREFIX: &str = "_et_";
const TEMPLATE_ID_HASH_HEX_LEN: usize = 12;

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
  serde_json::to_string(&canonical_template_value(value))
    .expect("Template Definition canonical content must serialize")
}

pub(super) fn template_identity_from_compiled_template(value: &Value) -> TemplateIdentity {
  let canonical_content = canonical_template_content(value);
  let hash = Sha256::digest(canonical_content.as_bytes());
  let hash_hex = hex::encode(hash);

  TemplateIdentity {
    template_id: format!(
      "{}{}",
      TEMPLATE_ID_PREFIX,
      &hash_hex[..TEMPLATE_ID_HASH_HEX_LEN]
    ),
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

fn canonical_template_value(value: &Value) -> Value {
  match value {
    Value::Array(items) => Value::Array(items.iter().map(canonical_template_value).collect()),
    Value::Object(map) => {
      let mut entries = map.iter().collect::<Vec<_>>();
      entries.sort_by(|(left_key, _), (right_key, _)| left_key.cmp(right_key));

      let mut canonical = serde_json::Map::new();
      for (key, value) in entries {
        canonical.insert(key.clone(), canonical_template_value(value));
      }

      Value::Object(canonical)
    }
    _ => value.clone(),
  }
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
