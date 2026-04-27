import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";

loadMontserrat("normal", { weights: ["400", "500", "600", "700", "800", "900"] });
loadInter("normal", { weights: ["400", "500", "600", "700", "800", "900"] });
loadPoppins("normal", { weights: ["400", "500", "600", "700", "800", "900"] });
loadOswald("normal", { weights: ["400", "500", "600", "700"] });
loadRoboto("normal", { weights: ["400", "500", "700", "900"] });
loadAnton("normal", { weights: ["400"] });
loadBebasNeue("normal", { weights: ["400"] });

export const SUPPORTED_FONTS = [
  "Montserrat",
  "Inter",
  "Poppins",
  "Oswald",
  "Roboto",
  "Anton",
  "Bebas Neue",
] as const;
