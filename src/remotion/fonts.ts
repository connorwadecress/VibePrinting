import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadNotoColorEmoji } from "@remotion/google-fonts/NotoColorEmoji";

const LATIN: ["latin"] = ["latin"];

loadMontserrat("normal", { weights: ["400", "700", "900"], subsets: LATIN });
loadInter("normal", { weights: ["400", "700", "900"], subsets: LATIN });
loadPoppins("normal", { weights: ["400", "700", "900"], subsets: LATIN });
loadOswald("normal", { weights: ["400", "700"], subsets: LATIN });
loadRoboto("normal", { weights: ["400", "700", "900"], subsets: LATIN });
loadAnton("normal", { weights: ["400"], subsets: LATIN });
loadBebasNeue("normal", { weights: ["400"], subsets: LATIN });
// Color emoji font — used as a fallback in every fontFamily stack so
// emoji codepoints in Reddit titles/bodies/comments + captions render
// instead of falling through to a missing-glyph box. The headless
// Chromium that Remotion uses does not ship system emoji fonts.
loadNotoColorEmoji("normal", { weights: ["400"], subsets: ["emoji"] });

/**
 * Append to every fontFamily stack used in the rendered video so emoji
 * codepoints fall through to Noto Color Emoji while Latin text keeps
 * using the primary font. The leading comma + space matters — callers
 * concatenate this onto their existing stack.
 */
export const EMOJI_FONT_FALLBACK = ', "Noto Color Emoji"';

export const SUPPORTED_FONTS = [
  "Montserrat",
  "Inter",
  "Poppins",
  "Oswald",
  "Roboto",
  "Anton",
  "Bebas Neue",
] as const;
