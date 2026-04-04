export function log(stage: string, message: string): void {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] [${stage}] ${message}`);
}

export function logError(stage: string, message: string): void {
  const time = new Date().toLocaleTimeString();
  console.error(`[${time}] [${stage}] ERROR: ${message}`);
}

export function logTiming(stage: string, startMs: number): void {
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  log(stage, `completed in ${elapsed}s`);
}
