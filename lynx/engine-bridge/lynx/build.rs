fn main() {
  println!("cargo:rerun-if-env-changed=LYNX_LIB_PATH");
  println!("cargo:rerun-if-env-changed=LYNX_SDK_DIR");
}
