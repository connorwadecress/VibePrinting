import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { ensureApprovalGate, haltForApproval, isApproved, writeApprovalGate } from "../../utils/approval-gates.js";
import { log } from "../../utils/logger.js";

export class ScriptApprovalGateStage implements PipelineStage {
  readonly name = "script-approval-gate";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (!state.script) throw new Error("No script in pipeline state");

    const gate = ensureApprovalGate(state, context.workDir, "script-gate", "Script approval", "script.json");
    writeApprovalGate(context.workDir, gate);

    if (isApproved(gate.status)) {
      log(this.name, "Script approved — continuing");
      return;
    }

    haltForApproval(
      state,
      context.workDir,
      gate,
      "Script approval is required before scene planning and production continue.",
    );
  }
}
