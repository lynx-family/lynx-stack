/// Leo Assembly (LEO ASM) module.
///
/// This module defines the instruction set (opcodes) and operation structure for the Leo engine.
/// These operations are used to manipulate the element tree (e.g., creating elements, setting attributes, appending children).
///
/// Key components:
/// - `operation`: Defines the `Operation` struct and `LEOAsmOpcode` enum.
/// - `LEOAsmOpcode`: Enumerates the supported operations (e.g., `SetAttribute`, `AppendChild`).
mod operation;
#[cfg(any(feature = "encode", feature = "client"))]
pub(crate) use operation::LEOAsmOpcode;
pub(crate) use operation::Operation;
