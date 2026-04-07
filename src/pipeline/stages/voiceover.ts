import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import path from "node:path";

export class VoiceoverStage implements PipelineStage {
  readonly name = "voiceover";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const script = state.script;
    if (!script) throw new Error("No script in pipeline state");

    // Let the provider select the best voice and speed for this topic/script
    if (context.tts.configure && state.topic && state.lane) {
      context.tts.configure({ topic: state.topic, lane: state.lane, script });
    }

    const parts = [
      script.hook,
      ...script.beats.map((b) => b.narration),
      script.payoff,
    ];
    const narrationText = parts.join(" ");

    const outputPath = path.join(context.workDir, "voiceover.mp3");
    state.voiceover = await context.tts.synthesize(narrationText, outputPath);
  }
}
