import { Composition } from "remotion";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="CaptionOverlay"
        lazyComponent={() => import("./CaptionOverlay.js")}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="RedditCardsOverlay"
        lazyComponent={() => import("./RedditCardsOverlay.js")}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
