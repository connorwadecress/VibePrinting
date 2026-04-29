import type { MusicTrack } from "../models.js";

export interface MusicSearchContext {
  /** Voiceover length the music must cover. Music tracks shorter than this are looped by ffmpeg. */
  targetDurationSeconds: number;
}

/**
 * Source of background music tracks. v1 is a local library reader.
 * Future implementations could pull from a stock-music API.
 */
export interface MusicProvider {
  pickTrack(ctx: MusicSearchContext): Promise<MusicTrack>;
}
