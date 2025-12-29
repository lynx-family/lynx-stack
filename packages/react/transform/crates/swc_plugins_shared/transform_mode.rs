#[derive(Debug, PartialEq, Clone, Copy)]
pub enum TransformMode {
  /// Transform for production.
  Production,
  /// Transform for development.
  Development,
  /// Transform for testing.
  Test,
}
