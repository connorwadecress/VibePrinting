import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";

const LATIN: ["latin"] = ["latin"];

loadMontserrat("normal", { weights: ["400", "700", "900"], subsets: LATIN });
loadInter("normal", { weights: ["400", "700", "900"], subsets: LATIN });
loadPoppins("normal", { weights: ["400", "700", "900"], subsets: LATIN });
loadOswald("normal", { weights: ["400", "700"], subsets: LATIN });
loadRoboto("normal", { weights: ["400", "700", "900"], subsets: LATIN });
loadAnton("normal", { weights: ["400"], subsets: LATIN });
loadBebasNeue("normal", { weights: ["400"], subsets: LATIN });

export const SUPPORTED_FONTS = [
  "Montserrat",
  "Inter",
  "Poppins",
  "Oswald",
  "Roboto",
  "Anton",
  "Bebas Neue",
] as const;
