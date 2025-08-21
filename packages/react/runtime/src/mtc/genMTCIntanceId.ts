let gMTCInstanceId = 1;

export function genMTCInstanceId(): number {
  return gMTCInstanceId++;
}
