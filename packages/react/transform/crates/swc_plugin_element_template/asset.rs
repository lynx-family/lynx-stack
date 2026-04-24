use serde::Serialize;
use swc_core::common::comments::Comments;

use super::JSXTransformer;

#[derive(Serialize, Debug, Clone)]
pub struct ElementTemplateAsset {
  // The compiled template is exported out-of-band from the JS module. The JS
  // output keeps using a synthetic component tag so existing React/SWC passes can
  // continue to own expression lowering and runtime value transport.
  pub template_id: String,
  pub compiled_template: serde_json::Value,
  pub source_file: String,
}

const BUILTIN_RAW_TEXT_TEMPLATE_ID: &str = "__et_builtin_raw_text__";

impl<C> JSXTransformer<C>
where
  C: Comments + Clone,
{
  fn builtin_raw_text_template_asset(&self) -> ElementTemplateAsset {
    ElementTemplateAsset {
      template_id: BUILTIN_RAW_TEXT_TEMPLATE_ID.to_string(),
      compiled_template: serde_json::json!({
        "kind": "element",
        "type": "raw-text",
        "attributesArray": [
          {
            "kind": "attribute",
            "key": "text",
            "binding": "slot",
            "attrSlotIndex": 0,
          }
        ],
        "children": [],
      }),
      source_file: self.cfg.filename.clone(),
    }
  }

  pub(super) fn ensure_builtin_element_templates(&self) {
    let Some(element_templates) = &self.element_templates else {
      return;
    };

    let mut templates = element_templates.borrow_mut();
    if templates.is_empty() {
      return;
    }

    // Raw text can also appear as dynamic element-slot content. Emitting the
    // builtin template only when user ET templates exist keeps non-ET transforms
    // free of template metadata while giving runtime a stable key for text slots.
    if templates
      .iter()
      .any(|template| template.template_id == BUILTIN_RAW_TEXT_TEMPLATE_ID)
    {
      return;
    }

    templates.push(self.builtin_raw_text_template_asset());
  }
}
