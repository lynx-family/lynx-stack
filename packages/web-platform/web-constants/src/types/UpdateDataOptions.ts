export const enum NativeUpdateDataType {
  UPDATE = 0,
  RESET = 1,
}

export interface UpdateDataOptions {
  type?: NativeUpdateDataType;
  processorName?: string;
}
