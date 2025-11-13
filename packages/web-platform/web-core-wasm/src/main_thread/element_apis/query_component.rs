use super::MainThreadGlobalThis;
use crate::template::TemplateManager;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__wasm_binding_queryComponent")]
  /**
   * The wasm binding for __queryComponent
   * This is a async function
   * js wrapper should return a sync null
   */
  pub async fn query_component(
    &mut self,
    url: String,
    template_manager: &mut TemplateManager,
  ) -> Result<wasm_bindgen::JsValue, wasm_bindgen::JsValue> {
    let maybe_template = template_manager.get_cached_template(&url);
    if let Some(template) = maybe_template {
      if let Some(root_chunk_url) = template.get_lepus_code_url("root") {
        let mut lepus_root_chunk_export = self
          .mts_realm
          .loadScript(root_chunk_url.as_str())
          .await
          .unwrap_err();
        let process_eval_result_js_callback = js_sys::Reflect::get(
          &self.mts_realm.getGlobalThis(),
          &wasm_bindgen::JsValue::from_str("processEvalResult"),
        )
        .unwrap_err();
        if process_eval_result_js_callback.is_function() {
          lepus_root_chunk_export = process_eval_result_js_callback
            .dyn_into::<js_sys::Function>()
            .unwrap()
            .call2(
              &wasm_bindgen::JsValue::NULL,
              &lepus_root_chunk_export,
              &wasm_bindgen::JsValue::from_str(&url),
            )
            .unwrap_err();
        }
        let manifest_chunk = template.get_manifest_code();
        let manifest_js_object = js_sys::Object::from(js_sys::Array::from_iter(
          manifest_chunk.iter().map(|(k, v)| {
            js_sys::Array::of2(
              &wasm_bindgen::JsValue::from_str(k),
              &wasm_bindgen::JsValue::from_str(v),
            )
          }),
        ));
        self
          .style_manager
          .push_style_sheet(template.get_style_info(), Some(&url));
        self
          .bts_rpc
          .update_background_js_module_cache(&manifest_js_object)
          .await;
        self
          .bts_rpc
          .dispatch_js_context_instance_event(
            "__OnDynamicJSSourcePrepared",
            &wasm_bindgen::JsValue::from_str(&url),
          )
          .await;
        return Ok(lepus_root_chunk_export);
      }
    }
    Ok(wasm_bindgen::JsValue::NULL)
  }
}
