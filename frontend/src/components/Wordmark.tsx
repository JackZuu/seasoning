import SaltShakerLogo from "./SaltShakerLogo";
import { colors, fonts } from "../theme";

interface Props {
  /** Layout: stacked (shaker above wordmark) or inline (shaker beside wordmark). */
  layout?: "stacked" | "inline";
  /** Size of the salt shaker icon in px. */
  iconSize?: number;
  /** Wordmark font size in px. */
  wordSize?: number;
  /** Show the "A pinch of you" tagline below. */
  tagline?: boolean;
  /** White on teal (default) vs teal on cream. */
  variant?: "light" | "dark";
}

export default function Wordmark({
  layout = "inline",
  iconSize = 36,
  wordSize = 28,
  tagline = false,
  variant = "light",
}: Props) {
  const fg = variant === "light" ? colors.white : colors.green;

  const word = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: layout === "stacked" ? "center" : "flex-start", lineHeight: 1 }}>
      <span
        style={{
          fontFamily: fonts.display,
          fontWeight: 600,
          fontStyle: "italic",
          fontSize: wordSize,
          color: fg,
          letterSpacing: "-0.01em",
          fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 144',
        }}
      >
        seasoning
      </span>
      {tagline && (
        <span
          style={{
            fontFamily: fonts.script,
            fontSize: Math.max(14, Math.round(wordSize * 0.5)),
            color: fg,
            opacity: 0.95,
            marginTop: 2,
          }}
        >
          A pinch of you
        </span>
      )}
    </div>
  );

  if (layout === "stacked") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <SaltShakerLogo size={iconSize} color={fg} />
        {word}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <SaltShakerLogo size={iconSize} color={fg} />
      {word}
    </div>
  );
}
