use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use swc_core::common::{
  errors::{DiagnosticBuilder, DiagnosticId, Emitter, Level},
  sync::Lrc,
  FileLines, SourceMapperDyn,
};

/// This is esbuild's PartialMessage definition.
/// https://github.com/evanw/esbuild/blob/043ab306c490f692c68e8d254bbf00b6468be87d/lib/shared/types.ts#L421
#[napi(object)]
#[derive(PartialEq, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PartialMessage {
  pub id: Option<String>,
  pub plugin_name: Option<String>,
  pub text: Option<String>,
  pub location: Option<PartialLocation>,
  pub notes: Option<Vec<PartialNote>>,
  pub detail: Option<String>,
}

#[napi(object)]
#[derive(PartialEq, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PartialNote {
  pub text: Option<String>,
  pub location: Option<PartialLocation>,
}

#[napi(object)]
#[derive(PartialEq, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PartialLocation {
  pub file: Option<String>,
  pub namespace: Option<String>,
  pub line: Option<u32>,
  pub column: Option<u32>,
  pub length: Option<u32>,
  pub line_text: Option<String>,
  pub suggestion: Option<String>,
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  #[test]
  fn test_partial_message() {
    let json = json!({
        "pluginName": "test",
        "text": "test",
        "location": {
            "file": "test",
            "namespace": "test",
            "line": 1,
            "column": 0,
            "length": 1,
            "lineText": "test",
            "suggestion": "test",
        },
        "notes": [
            {
                "text": "test",
                "location": {
                    "file": "test",
                    "namespace": "test",
                    "line": 1,
                    "column": 0,
                    "length": 1,
                    "lineText": "test",
                    "suggestion": "test",
                },
            },
        ],
        "detail": "test",
    });
    let s: PartialMessage = serde_json::from_value(json).unwrap();

    assert_eq!(s.plugin_name, Some("test".to_string()));
    assert_eq!(s.text, Some("test".to_string()));
    assert_eq!(s.location.unwrap().file, Some("test".to_string()));
    assert_eq!(s.notes.unwrap()[0].text, Some("test".to_string()));
    assert_eq!(s.detail, Some("test".to_string()));
  }

  #[test]
  fn test_partial_location() {
    let s = PartialLocation {
      file: Some("test".to_string()),
      namespace: Some("test".to_string()),
      line: Some(1),
      column: Some(0),
      length: Some(1),
      line_text: Some("test".to_string()),
      suggestion: Some("test".to_string()),
    };

    let json = json!({
        "file": "test",
        "namespace": "test",
        "line": 1,
        "column": 0,
        "length": 1,
        "lineText": "test",
        "suggestion": "test",
    });

    assert_eq!(s, serde_json::from_value(json).unwrap());
  }
}

pub struct EsbuildEmitter {
  pub errors: Lrc<RwLock<Vec<PartialMessage>>>,
  pub warnings: Lrc<RwLock<Vec<PartialMessage>>>,

  plugin_name: String,
  source_map: Option<Lrc<SourceMapperDyn>>,
}

impl EsbuildEmitter {
  pub fn new(
    plugin_name: String,
    source_map: Option<Lrc<SourceMapperDyn>>,
  ) -> (
    Self,
    Lrc<RwLock<Vec<PartialMessage>>>,
    Lrc<RwLock<Vec<PartialMessage>>>,
  ) {
    let errors = Lrc::new(RwLock::new(vec![]));
    let warnings = Lrc::new(RwLock::new(vec![]));

    (
      Self {
        errors: errors.clone(),
        warnings: warnings.clone(),

        plugin_name,
        source_map,
      },
      errors,
      warnings,
    )
  }
}

impl Emitter for EsbuildEmitter {
  fn emit(&mut self, msg: &mut DiagnosticBuilder<'_>) {
    let partial_message = PartialMessage {
      id: msg.code.as_ref().map(|code| match code {
        DiagnosticId::Error(id) => id.to_string(),
        DiagnosticId::Lint(id) => id.to_string(),
      }),
      plugin_name: Some(self.plugin_name.clone()),
      text: Some(msg.message().to_string()),
      location: if let (Some(sm), Some(primary_span)) =
        (self.source_map.as_ref(), msg.span.primary_span().as_ref())
      {
        let loc = sm.lookup_char_pos(primary_span.lo());
        let filename = sm.span_to_filename(*primary_span);

        let mut location = PartialLocation {
          file: Some(filename.to_string()),
          namespace: None,
          line: Some(loc.line as u32),
          column: Some(loc.col.0 as u32),
          length: Some(primary_span.hi().0 - primary_span.lo().0),
          line_text: None,
          suggestion: None,
        };

        match sm.span_to_lines(*primary_span) {
          Ok(FileLines { lines, file }) => {
            lines.iter().for_each(|line| {
              if line.line_index + 1 == loc.line {
                if let Some(line_text) = file.get_line(line.line_index) {
                  location.line_text = Some(line_text.to_string());
                }
              }
            });
          }
          Err(_) => {}
        }

        Some(location)
      } else {
        None
      },
      notes: None,
      detail: None,
    };

    match msg.level {
      Level::Bug | Level::Fatal | Level::PhaseFatal | Level::Error => {
        self.errors.write().unwrap().push(partial_message);
      }
      Level::Warning => {
        self.warnings.write().unwrap().push(partial_message);
      }
      _ => {
        todo!()
      }
    }
  }
}
