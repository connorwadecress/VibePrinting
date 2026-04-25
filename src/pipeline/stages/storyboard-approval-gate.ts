import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { ensureApprovalGate, haltForApproval, isApproved, writeApprovalGate } from "../../utils/approval-gates.js";
import { log } from "../../utils/logger.js";

export class StoryboardApprovalGateStage implements PipelineStage {
  readonly name = "storyboard-approval-gate";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (!state.storyboard) throw new Error("No storyboard in pipeline state");

    const gate = ensureApprovalGate(
      state,
      context.workDir,
      "storyboard-gate",
      "Storyboard approval",
      "storyboard.json",
    );
    writeApprovalGate(context.workDir, gate);

    if (isApproved(gate.status)) {
      log(this.name, "Storyboard approved — continuing");
      return;
    }

    haltForApproval(
      state,
      context.workDir,
      gate,
      "Storyboard approval is required before voiceover, footage sourcing, and assembly continue.",
    );
  }
}
