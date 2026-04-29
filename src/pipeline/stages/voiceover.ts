import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { alignTimingsToOriginal, prepareTextForTts } from "../../utils/text-prep.js";
import path from "node:path";

export class VoiceoverStage implements PipelineStage {
  readonly name = "voiceover";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const script = state.script;
    if (!script) throw new Error("No script in pipeline state");

    const parts = [
      script.hook,
      ...script.beats.map((b) => b.narration),
      script.payoff,
    ];
    const narrationText = parts.join(" ");
    const ttsText = prepareTextForTts(narrationText);

    const outputPath = path.join(context.workDir, "voiceover.mp3");
    const result = await context.tts.synthesize(ttsText, outputPath);
    // Re-attach original-text grammar (parens, quotes, slashes) to the
    // alphanumeric-only word timings the TTS provider returns.
    result.wordTimings = alignTimingsToOriginal(result.wordTimings, narrationText);
    state.voiceover = result;
  }
}
