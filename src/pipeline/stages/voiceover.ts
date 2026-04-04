import type { ShortScript, VoiceoverResult } from "../../domain/models.js";
import type { AppConfig } from "../../config.js";
import { generateVoiceover } from "../../providers/tts.js";
import path from "node:path";

export async function createVoiceover(
  script: ShortScript,
  workDir: string,
  config: AppConfig,
): Promise<VoiceoverResult> {
  // Build full narration text from script parts
  const parts = [
    script.hook,
    ...script.beats.map((b) => b.narration),
    script.payoff,
    script.callToAction,
  ];
  const narrationText = parts.join(" ");

  const outputPath = path.join(workDir, "voiceover.mp3");
  return generateVoiceover(narrationText, outputPath, config.ttsVoice, config.ttsRate);
}
