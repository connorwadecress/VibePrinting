import type { CSSProperties } from "react";
import type { RedditStorySegment } from "../domain/models.js";

export interface RedditCardProps {
  segment: RedditStorySegment;
  subreddit: string;
  currentMs: number;
  cardInitialReveal: "empty" | "first-sentence";
  cardMaxHeightPx: number;
}

const SENTENCE_END = /[.!?](\s|$)/;

function firstSentenceWordCount(words: { text: string }[]): number {
  for (let i = 0; i < words.length; i++) {
    if (SENTENCE_END.test(words[i].text + " ")) return i + 1;
  }
  return Math.min(words.length, 8);
}

function visibleWordCount(
  segment: RedditStorySegment,
  currentMs: number,
  initialReveal: "empty" | "first-sentence",
): number {
  const timings = segment.wordTimings ?? [];
  if (timings.length === 0) {
    return (segment.text.length > 0 && currentMs >= (segment.startSeconds ?? 0) * 1000)
      ? Number.MAX_SAFE_INTEGER
      : 0;
  }
  let revealed = 0;
  for (const w of timings) {
    if (currentMs >= w.startMs) revealed++;
    else break;
  }
  if (initialReveal === "first-sentence" && currentMs >= (segment.startSeconds ?? 0) * 1000) {
    revealed = Math.max(revealed, firstSentenceWordCount(timings));
  }
  return revealed;
}

function visibleText(segment: RedditStorySegment, n: number): string {
  if (n === 0) return "";
  const timings = segment.wordTimings ?? [];
  if (timings.length === 0) return segment.text;
  const slice = timings.slice(0, Math.min(n, timings.length));
  return slice.map((t) => t.text).join(" ");
}

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontSize: 28,
  color: "#1a1a1b",
  marginBottom: 14,
};

const subPill: CSSProperties = {
  fontWeight: 700,
};

const author: CSSProperties = {
  color: "#7c7c7c",
};

const scoreChip: CSSProperties = {
  marginLeft: "auto",
  background: "#ff4500",
  color: "white",
  borderRadius: 999,
  padding: "4px 14px",
  fontWeight: 700,
  fontSize: 24,
};

const cardBase: CSSProperties = {
  background: "#ffffff",
  borderRadius: 24,
  padding: "28px 32px",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  fontFamily: "Inter, -apple-system, system-ui, sans-serif",
  color: "#1a1a1b",
  width: "calc(100% - 80px)",
  maxWidth: 980,
  margin: "0 auto",
  position: "absolute",
  left: 0,
  right: 0,
  top: "12%",
  overflow: "hidden",
};

const titleStyle: CSSProperties = {
  fontSize: 44,
  fontWeight: 700,
  lineHeight: 1.2,
};

const bodyStyle: CSSProperties = {
  fontSize: 38,
  fontWeight: 500,
  lineHeight: 1.32,
  whiteSpace: "pre-wrap",
};

const introSplash: CSSProperties = {
  position: "absolute",
  top: "10%",
  left: 0,
  right: 0,
  textAlign: "center",
  color: "white",
  fontFamily: "Inter, -apple-system, system-ui, sans-serif",
  fontSize: 96,
  fontWeight: 800,
  letterSpacing: -1,
  textShadow: "0 6px 24px rgba(0,0,0,0.7)",
};

export function RedditCard(props: RedditCardProps) {
  const { segment, subreddit, currentMs, cardInitialReveal, cardMaxHeightPx } = props;

  if (segment.kind === "intro" || segment.kind === "outro") {
    if (segment.kind === "intro") {
      return <div style={introSplash}>r/{subreddit}</div>;
    }
    return null;
  }

  const isQuestion = segment.kind === "question";
  const n = visibleWordCount(segment, currentMs, cardInitialReveal);
  const text = visibleText(segment, n);

  // The body is clipped by `maxHeight + overflow:hidden` and pinned to the
  // bottom of the clip box via flex `justifyContent: flex-end`. When text
  // grows past the cap, the most recently-revealed line stays visible —
  // same effect as auto-scroll without needing useEffect/useState in the
  // headless render context.
  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <span style={subPill}>r/{subreddit}</span>
        {!isQuestion && segment.author && <span style={author}>· u/{segment.author}</span>}
        {!isQuestion && typeof segment.score === "number" && (
          <span style={scoreChip}>▲ {segment.score.toLocaleString()}</span>
        )}
      </div>
      {isQuestion ? (
        <div style={titleStyle}>{segment.text}</div>
      ) : (
        <div
          style={{
            maxHeight: cardMaxHeightPx,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div style={bodyStyle}>{text || " "}</div>
        </div>
      )}
    </div>
  );
}
