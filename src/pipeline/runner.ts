import type { PipelineStage, StageContext } from "../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../domain/models.js";
import { log, logTiming } from "../utils/logger.js";
import { isPipelineHalt } from "../utils/pipeline-halt.js";

/**
 * Generic pipeline runner — executes an ordered list of stages.
 * Stages read/write a shared PipelineState and pull providers from StageContext.
 */
export async function runPipeline(
  stages: PipelineStage[],
  context: StageContext,
  state: PipelineState = {},
): Promise<PipelineState> {
  const pipelineStart = Date.now();

  for (const stage of stages) {
    log("pipeline", `Running: ${stage.name}`);
    const stageStart = Date.now();
    try {
      await stage.execute(state, context);
      logTiming(stage.name, stageStart);
    } catch (error) {
      if (isPipelineHalt(error)) {
        log(stage.name, `halted: ${error.message}`);
        logTiming(stage.name, stageStart);
        break;
      }
      throw error;
    }

    if (state.halted) {
      log(stage.name, `halted: ${state.haltReason ?? "pipeline halted"}`);
      break;
    }
  }

  logTiming("pipeline", pipelineStart);
  return state;
}
