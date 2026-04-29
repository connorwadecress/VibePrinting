import type {
  GameplayProvider,
  GameplaySearchContext,
} from "../../domain/interfaces/gameplay-provider.js";
import type { GameplayClip } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

/**
 * Tries `primary` first; falls back to `fallback` only if primary throws.
 * Used to wire the brand-local library before yt-dlp.
 */
export class CompositeGameplayProvider implements GameplayProvider {
  constructor(
    private readonly primary: GameplayProvider,
    private readonly fallback: GameplayProvider | null,
  ) {}

  async findClip(ctx: GameplaySearchContext): Promise<GameplayClip> {
    try {
      return await this.primary.findClip(ctx);
    } catch (primaryErr) {
      if (!this.fallback) throw primaryErr;
      log(
        "gameplay",
        `Primary provider failed, falling back: ${(primaryErr as Error).message}`,
      );
      return await this.fallback.findClip(ctx);
    }
  }
}
