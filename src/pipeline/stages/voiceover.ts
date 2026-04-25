import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { log } from "../../utils/logger.js";
import { writeVoiceoverMeta } from "../../utils/run-resume.js";
import path from "node:path";

export class VoiceoverStage implements PipelineStage {
  readonly name = "voiceover";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (state.voiceover) {
      log(this.name, `Resume: reusing voiceover (${state.voiceover.durationSeconds.toFixed(1)}s)`);
      return;
    }

    const script = state.script;
    if (!script) throw new Error("No script in pipeline state");

    const parts = [
      script.hook,
      ...script.beats.map((b) => b.narration),
      script.payoff,
    ];
    const narrationText = parts.join(" ");

    const outputPath = path.join(context.workDir, "voiceover.mp3");
    state.voiceover = await context.tts.synthesize(narrationText, outputPath);
    writeVoiceoverMeta(context.workDir, state.voiceover);
  }
}
