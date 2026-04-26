import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { ensureApprovalGate, haltForApproval, isApproved, writeApprovalGate } from "../../utils/approval-gates.js";
import { log } from "../../utils/logger.js";

export class FinalApprovalGateStage implements PipelineStage {
  readonly name = "final-approval-gate";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (!state.outputVideoPath) throw new Error("No output video path in pipeline state");

    const gate = ensureApprovalGate(
      state,
      context.workDir,
      "final-gate",
      "Final publish approval",
      "final-video",
    );
    writeApprovalGate(context.workDir, gate);

    if (isApproved(gate.status)) {
      log(this.name, "Final approval granted — continuing");
      return;
    }

    haltForApproval(
      state,
      context.workDir,
      gate,
      "Final publish approval is required before upload can proceed.",
    );
  }
}
