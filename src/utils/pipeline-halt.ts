export class PipelineHalt extends Error {
  readonly gateId?: string;

  constructor(message: string, gateId?: string) {
    super(message);
    this.name = "PipelineHalt";
    this.gateId = gateId;
  }
}

export function isPipelineHalt(error: unknown): error is PipelineHalt {
  return error instanceof PipelineHalt;
}
