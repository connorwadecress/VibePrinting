import type { PipelineStage, StageContext } from "../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../domain/models.js";
import { log, logTiming } from "../utils/logger.js";

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
    await stage.execute(state, context);
    logTiming(stage.name, stageStart);
  }

  logTiming("pipeline", pipelineStart);
  return state;
}
