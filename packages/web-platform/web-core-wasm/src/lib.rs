mod constants;
mod main_thread;
mod rpc;
mod template;
extern crate alloc;
use lazy_static::lazy_static;

lazy_static! {
  pub(crate) static ref TEMPLATE_MANAGER: template::TemplateManager =
    template::TemplateManager::new();
}
